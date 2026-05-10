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

itsMade is a WhatsApp-first feedback platform for a Mexican professional cleaning services company. After a service is completed, an admin clicks **"Solicitar feedback"** on `/services`; **Evolution API** (self-hosted Baileys) sends an opening message via WhatsApp; the customer replies; the system runs an **Anthropic Claude** agent loop that asks 5 rating questions, normalizes free-form answers ("muy bien", "10/10", "regular") to 1-5 scores, persists to **Supabase**, and computes an average + NPS bucket.

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
     check (agent_type in ('feedback', 'your_new_agent'));
   ```
4. Update `AgentType` union in `src/lib/supabase/types.ts`.

The router file (`src/lib/conversation/router.ts`) never grows — it just calls `dispatchAgent(conversation.agent_type)`. Each agent owns its own folder.

### The feedback agent

`src/lib/agents/feedback/agent.ts`: tool-use loop, max 6 iterations, 1024 max_tokens. System prompt cached with `cache_control: ephemeral`. Four tools (`src/lib/agents/feedback/tools.ts`):

- `record_answer(question_index, raw_answer, normalized_score?, normalized_text?)` — UPSERTs into `feedback_answers` with `ON CONFLICT (request_id, question_index)`. Validates `question_index === state.current_question`, advances state.
- `request_clarification(question_index, clarification_message)` — sets `state.awaiting = {kind:'clarification', ...}`. Doesn't advance.
- `finalize_feedback()` — guards `current_question === 5 + last answer present`, computes avg of P1-P4 normalized_scores rounded to 1 decimal, assigns NPS bucket (≥4.5 promoter, ≥3.5 passive, else detractor), updates `feedback_requests` to `completed`, closes conversation.
- `escalate_to_human(reason)` — sets `conversations.status='escalated'`, `state.handoff = {reason, at}`, also sets `feedback_requests.status='escalated'`.

The agent works on a **deep-cloned** state and persists it via `saveConversationState` at the end of the turn. Turns are kept up to 30 in DB; only the last 10 are sent to Claude as message history.

### Cold contacts

If a customer messages itsMade without an open feedback request, `runFeedbackTurn` sees no `feedback_request_id` in state and returns `reply: ""` (silence). The admin sees the inbound in `/conversations` and decides whether to act.

### Conversation state lives in a JSONB column

`conversations.state` (jsonb) holds the agent-specific state. The agent state is a discriminated union typed as `ConversationState` in `src/lib/supabase/types.ts`. For feedback, the shape is `FeedbackConversationState` with `feedback_request_id`, `service_job_id`, `current_question`, `answers[5]`, `awaiting`, `handoff`, `turns[]`. Use `isFeedbackState()` type guard before narrowing.

### Supabase access pattern

Two clients, never crossed:

- **`supabaseServer()`** (`src/lib/supabase/server.ts`) — service-role, server-only, **bypasses RLS**. RLS is currently disabled on all data tables (MVP) — only `profiles` has RLS enabled (with `is_admin()` policies). Migrating to user-facing access requires enabling RLS on data tables and writing policies first.
- **`supabaseBrowser()`** + **`supabaseServerAuth()`** (`@supabase/ssr`) — anon-key clients used for the admin panel auth flow only.

Types in `src/lib/supabase/types.ts` are **manually maintained** to mirror the migrations. There's no `supabase gen types` step yet.

### Auth & route protection

`src/middleware.ts` runs Supabase SSR auth on every non-static request. Public routes are matched against an explicit allow-list of regexes (root, `/login`, `/forgot-password`, `/reset-password`, `/auth/*`, `/api/health`, `/api/webhook/*`, `/api/cron/*`). Anything else redirects to `/login?next=...`. App routes are organized by route groups: `(admin)` (services, feedback, conversations, branches, catalog, settings, users) and `(auth)` (login flows). `requireAdmin()` redirects to `/services?error=admin_only` if the user isn't admin.

### Cron

Vercel Cron (`vercel.json`) hits two endpoints daily:

- `/api/cron/expire-feedback-requests` at 09:00 UTC — marks `feedback_requests` with `sent_at < now() - FEEDBACK_REQUEST_EXPIRY_HOURS` (default 48h) and status `pending`/`in_progress` as `expired`. Closes their conversations.
- `/api/cron/close-stale-conversations` at 10:00 UTC — auto-closes conversations inactive longer than `CONVERSATION_AUTO_CLOSE_HOURS` (default 72h).

Both endpoints validate `Authorization: Bearer ${CRON_SECRET}` if `CRON_SECRET` is set; in dev (no `CRON_SECRET`) they accept calls without auth.

## Conventions

- **TypeScript**: strict mode, path alias `@/*` → `src/*`. Don't introduce relative imports across modules.
- **Environment**: All env access goes through `env()` (`src/lib/env.ts`) which validates with zod and caches. Use `resetEnvCache()` after runtime changes.
- **Logging**: `createLogger(scope)` (`src/lib/logger.ts`) — never use `console.*` directly in production code paths.
- **Language**: All user-facing copy and assistant replies are in **Spanish (es-MX)**. Many comments and identifiers are also in Spanish — match the surrounding style.
- **Server actions over API routes** for panel mutations (createBranch, requestFeedback, etc.). Return `ActionResult` for forms that show feedback inline (`useActionState`); return `void` + `revalidatePath` for fire-and-forget actions.
- **No test files** — typecheck + lint are the gates.

## What's NOT here yet

- PDF generation (planned for monthly reports; `serverExternalPackages: ["@react-pdf/renderer"]` is already wired in `next.config.ts`).
- Multi-idioma (only es-MX).
- Vision agent (no use case yet).
- Payment processing.
