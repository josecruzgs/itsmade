# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npm run dev         # Next.js dev server (localhost:3000)
npm run build       # Production build (output: standalone)
npm run start       # Run built server
npm run lint        # next lint
npm run typecheck   # tsc --noEmit (strict)
```

There is no test suite. `npm run typecheck` and `npm run lint` are the only automated quality gates.

### Local Evolution API stack

```powershell
docker compose up -d                                       # full local: Evolution + Postgres + Redis on port 8082, webhook -> host.docker.internal:3000
docker compose -f docker-compose.evolution-only.yml up -d  # hybrid VPS: only Evolution + deps; webhook posts to Vercel
```

Evolution Manager UI: `http://localhost:8082/manager` (use `EVOLUTION_API_KEY` as Global API Key, instance must be named `itsmade` to match `EVOLUTION_INSTANCE_NAME`).

### Operational scripts

```powershell
node scripts/create-admin.mjs <email> <password> [full_name]   # Create admin user via Supabase Admin API (reads .env.local)
```

## Architecture

itsMade is a WhatsApp-first platform for a Mexican professional cleaning services company. **Evolution API** (self-hosted Baileys) is the WhatsApp gateway; every inbound message is dispatched to one of three **Anthropic Claude** agents based on `conversations.agent_type`:

- **`info`** — default for cold contacts. Concierge that answers questions using `src/lib/agents/info/company-knowledge.md`. Calls `start_intake` to switch the conversation to the intake agent when the customer clearly wants to hire/quote.
- **`intake`** — collects `name → phone → description` step by step; `finalize_intake` inserts into `service_intake_requests` (status `pending_review`), upserts the customer, and escalates the conversation for human follow-up.
- **`feedback`** — post-service rating bot. Admin clicks **"Solicitar feedback"** on `/services`; the bot asks 5 rating questions, normalizes free-form answers ("muy bien", "10/10", "regular") to 1-5 scores, persists to **Supabase**, and computes an average + NPS bucket.

Agents can transfer mid-conversation by updating `conversations.agent_type` + `state` in DB (see `info.start_intake`). When this happens, the calling agent **skips its final `saveConversationState`** so the switch isn't overwritten — the next inbound message reaches the new agent with the fresh state.

### Deployment topology (hybrid)

Production runs split: **Vercel hosts Next.js**, a **VPS hosts Evolution + its own Postgres + Redis**. The Vercel app talks to Supabase (separate, managed) for application data — Evolution's Postgres is internal to Evolution only. See `DEPLOY_HYBRID.md` for the full split; `docker-compose.evolution-only.yml` is the VPS file, `docker-compose.yml` is the all-local dev file.

The VPS may be **shared with TomaLab**: itsMade uses port 8082 (TomaLab uses 8080), instance name `itsmade` (TomaLab uses `tomalab`), and all docker resources are prefixed `itsmade-` to avoid collisions.

### The webhook is the front door

`src/app/api/webhook/evolution/route.ts` is the single entry point for every inbound WhatsApp message. Critical pattern:

1. Validate `apikey` from header (`apikey` or `x-api-key`) **or** from body — Evolution v2 signs with `EVOLUTION_INSTANCE_TOKEN`, v1 with `EVOLUTION_API_KEY`; both are accepted from either header or body.
2. Reject unless `event === "messages.upsert"` and `instance` matches `EVOLUTION_INSTANCE_NAME`.
3. **Return 200 immediately** so Evolution doesn't retry.
4. Real work runs in `after()` so the webhook response isn't blocked by IA latency. Vercel function timeout is 60s (`vercel.json`).

The router (`src/lib/conversation/router.ts`) handles idempotency (`messages.evolution_message_id` UNIQUE — duplicate inbound is silently dropped) and human handoff (status `escalated` → bot does NOT respond, only logs the inbound). It then dispatches via the **agent registry**.

### Agent registry (extensible)

`src/lib/agents/registry.ts` is the dispatcher. To add a new agent:

1. Create `src/lib/agents/<name>/` with these 5 files:
   - `agent.ts` — exports `runXxxTurn: AgentHandler` (tool-use loop)
   - `tools.ts` — exports `xxxTools: Anthropic.Tool[]` and `XxxToolName` union
   - `prompt.ts` — exports `XXX_SYSTEM_PROMPT: string` (cached with `cache_control: ephemeral`)
   - `types.ts` — agent-specific types (often re-exported from `supabase/types.ts`)
   - `state.ts` — `emptyXxxState()`, `injectStateContext()`, type guards
2. Add the entry to `agentRegistry` in `src/lib/agents/registry.ts`.
3. Create a migration that extends the `conversations.agent_type` CHECK constraint:
   ```sql
   alter table conversations drop constraint conversations_agent_type_check;
   alter table conversations add constraint conversations_agent_type_check
     check (agent_type in ('feedback', 'info', 'intake', 'your_new_agent'));
   ```
4. Update `AgentType` union in `src/lib/supabase/types.ts`.
5. (Optional) Add a per-agent model override in `src/lib/agents/_shared/anthropic.ts` (`MODELS.your_agent = () => process.env.ANTHROPIC_YOUR_AGENT_MODEL ?? env().ANTHROPIC_MODEL`).

The router file (`src/lib/conversation/router.ts`) never grows — it just calls `dispatchAgent(conversation.agent_type)`. Each agent owns its own folder. Shared infra (Anthropic client singleton, model lookup) lives in `src/lib/agents/_shared/`.

### Per-agent shape (all three agents)

All agents follow the same envelope: tool-use loop, system prompt cached with `cache_control: ephemeral`, last 10 turns sent to Claude while up to 30 are kept in DB, state is **deep-cloned** before mutation and persisted with `saveConversationState` at end of turn. Differences:

- **feedback** (`src/lib/agents/feedback/`): max 6 tool iterations. Tools: `record_answer` (UPSERTs `feedback_answers` ON CONFLICT (request_id, question_index), advances `current_question`), `request_clarification` (sets `state.awaiting = {kind:'clarification',...}`, doesn't advance), `finalize_feedback` (guards `current_question === 5 + last answer present`, avgs P1-P4 scores → 1 decimal, NPS bucket: ≥4.5 promoter / ≥3.5 passive / else detractor, marks `feedback_requests.completed`, closes conversation), `escalate_to_human` (sets `conversations.status='escalated'` + `state.handoff` + `feedback_requests.status='escalated'`).
- **info** (`src/lib/agents/info/`): max 4 tool iterations. Stateless besides `turns[]` + `handoff`. Tools: `start_intake` (writes `agent_type='intake'` + fresh intake state in DB; agent sets `switchedAgent=true` and skips its own `saveConversationState`), `escalate_to_human`. Knowledge base is `company-knowledge.md` embedded into the system prompt via `buildInfoSystemPrompt()`.
- **intake** (`src/lib/agents/intake/`): max 6 tool iterations. State tracks `current_step` (`name` → `phone` → `description`). Tools: `record_field(field, value)` (advances `current_step` when field matches; for `phone` calls `normalizeMxWhatsApp`), `finalize_intake` (upserts `customers` by normalized phone, inserts `service_intake_requests` with `status='pending_review'`, escalates conversation), `escalate_to_human`.

### Cold contacts

The router defaults `agentType: "info"` in `getOrCreateConversation`, so a customer messaging itsMade without any prior context lands in the info concierge — not silence. The admin still sees the conversation in `/conversations`. Feedback conversations only exist when the admin triggered "Solicitar feedback" on `/services`, which overrides `agent_type` to `feedback` with a seeded `FeedbackConversationState` before the opening message is sent.

### Conversation state lives in a JSONB column

`conversations.state` (jsonb) is a discriminated union typed as `ConversationState` in `src/lib/supabase/types.ts`:

- `FeedbackConversationState` — `feedback_request_id`, `service_job_id`, `current_question`, `answers[5]`, `awaiting`, `handoff`, `turns[]`. Narrow with `isFeedbackState()`.
- `InfoConversationState` — `kind:'info'`, `handoff`, `turns[]`. The info agent rebuilds it fresh each turn from prior `turns[]`, tolerating an empty `{}` from new conversations.
- `IntakeConversationState` — `kind:'intake'`, `current_step` (`'name' | 'phone' | 'description' | 'done'`), partial fields, `request_id` (set after `finalize_intake`), `handoff`, `turns[]`. Narrow with `isIntakeState()`.

Each agent owns its `emptyXxxState()` and (where applicable) `injectStateContext()` helper in `state.ts` that emits a state block into the system prompt so the model knows what step it's on.

### Supabase access pattern

Two clients, never crossed:

- **`supabaseServer()`** (`src/lib/supabase/server.ts`) — service-role, server-only, **bypasses RLS**. RLS is currently disabled on all data tables (MVP) — only `profiles` has RLS enabled (with `is_admin()` policies). Migrating to user-facing access requires enabling RLS on data tables and writing policies first.
- **`supabaseBrowser()`** + **`supabaseServerAuth()`** (`@supabase/ssr`) — anon-key clients used for the admin panel auth flow only.

Types in `src/lib/supabase/types.ts` are **manually maintained** to mirror the migrations. There's no `supabase gen types` step yet.

### Auth & route protection

`src/middleware.ts` runs Supabase SSR auth on every non-static request. Public routes are matched against an explicit allow-list of regexes (root, `/login`, `/forgot-password`, `/reset-password`, `/auth/*`, `/api/health`, `/api/webhook/*`, `/api/cron/*`). Anything else redirects to `/login?next=...`. App routes are organized by route groups: `(admin)` (services, feedback, intake, conversations, clients, branches, catalog, employees, settings, users) and `(auth)` (login flows). `requireAdmin()` redirects to `/services?error=admin_only` if the user isn't admin.

### Cron

Vercel Cron (`vercel.json`) hits two endpoints daily:

- `/api/cron/expire-feedback-requests` at 09:00 UTC — marks `feedback_requests` with `sent_at < now() - FEEDBACK_REQUEST_EXPIRY_HOURS` (default 48h) and status `pending`/`in_progress` as `expired`. Closes their conversations.
- `/api/cron/close-stale-conversations` at 10:00 UTC — auto-closes conversations inactive longer than `CONVERSATION_AUTO_CLOSE_HOURS` (default 72h).

Both endpoints validate `Authorization: Bearer ${CRON_SECRET}` if `CRON_SECRET` is set; in dev (no `CRON_SECRET`) they accept calls without auth.

### Service sheet PDF

`/api/services/[id]/pdf` generates the per-job service sheet on the fly using **`pdf-lib`** (not `@react-pdf/renderer` — `next.config.ts` still lists the latter in `serverExternalPackages` from a prior iteration, but the actual implementation is `pdf-lib` via `src/lib/pdf/build-for-job.ts`). Returned as `application/pdf` attachment. Storage helpers in `src/lib/storage/service-pdfs.ts` lazy-create the `service-pdfs` Supabase Storage bucket. Migration `0007_employees_and_pdf.sql` adds `service_jobs.assigned_employee_id` and `service_jobs.pdf_sent_at`, plus the `employees` table.

### Phone normalization

WhatsApp phones are stored in canonical Mexican `521` + 10-digit format. **Always** route phones through `normalizeMxWhatsApp` (`src/lib/util/phone.ts`) before inserting into `customers.whatsapp_phone`, `employees.whatsapp_phone`, `service_intake_requests.requested_phone`, or `conversations.whatsapp_phone`. Migration `0008_normalize_phones.sql` rewrote existing rows in-place and is idempotent — re-running normalization yourself in app code is fine but unnecessary post-migration. UNIQUE constraints on `customers` + `employees` mean inconsistent formats used to create duplicates; do not regress this.

## Conventions

- **TypeScript**: strict mode, path alias `@/*` → `src/*`. Don't introduce relative imports across modules.
- **Environment**: All env access goes through `env()` (`src/lib/env.ts`) which validates with zod and caches. Use `resetEnvCache()` after runtime changes. Per-agent Anthropic model overrides (`ANTHROPIC_FEEDBACK_MODEL`, `ANTHROPIC_INFO_MODEL`, `ANTHROPIC_INTAKE_MODEL`) fall back to global `ANTHROPIC_MODEL`.
- **Logging**: `createLogger(scope)` (`src/lib/logger.ts`) — never use `console.*` directly in production code paths.
- **Language**: All user-facing copy and assistant replies are in **Spanish (es-MX)**. Many comments and identifiers are also in Spanish — match the surrounding style.
- **Server actions over API routes** for panel mutations (createBranch, requestFeedback, etc.). Return `ActionResult` for forms that show feedback inline (`useActionState`); return `void` + `revalidatePath` for fire-and-forget actions.
- **Migrations are append-only** (`supabase/migrations/0001..0008`) and types in `src/lib/supabase/types.ts` are hand-maintained — when you add/rename a column, update both.
- **No test files** — typecheck + lint are the gates.

## What's NOT here yet

- Multi-idioma (only es-MX).
- Vision agent (no use case yet).
- Payment processing.
- `supabase gen types` — types are still hand-written.
