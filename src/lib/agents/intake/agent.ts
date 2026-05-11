import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "@/lib/agents/_shared/anthropic";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import {
  saveConversationState,
  markConversationStatus,
} from "@/lib/conversation/state";
import type { AgentRunInput, AgentRunResult } from "@/lib/agents/registry";
import type {
  IntakeConversationState,
  IntakeStep,
  IntakeToolName,
} from "@/lib/agents/intake/types";
import { intakeTools } from "@/lib/agents/intake/tools";
import { INTAKE_SYSTEM_PROMPT } from "@/lib/agents/intake/prompt";
import {
  isIntakeState,
  emptyIntakeState,
  injectStateContext,
} from "@/lib/agents/intake/state";
import { normalizeMxWhatsApp } from "@/lib/util/phone";

const log = createLogger("intake-agent");
const MAX_TOOL_ITERATIONS = 6;

/**
 * Ejecuta un turno del agente intake con tool use loop.
 * Si el state no es de intake (raro, deberia haberlo seteado info.start_intake),
 * inicializa uno fresco.
 */
export async function runIntakeTurn(input: AgentRunInput): Promise<AgentRunResult> {
  const { conversation } = input;

  const state: IntakeConversationState = isIntakeState(conversation.state)
    ? (JSON.parse(JSON.stringify(conversation.state)) as IntakeConversationState)
    : emptyIntakeState();

  const history = state.turns.slice(-10);
  const stateBlock = injectStateContext(state);
  const userContent = `${stateBlock}\n\n[Mensaje del cliente]\n${input.userText}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map(
      (t): Anthropic.MessageParam => ({
        role: t.role,
        content: t.content,
      }),
    ),
    { role: "user", content: userContent },
  ];

  let finalReply = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic().messages.create({
      model: MODELS.intake(),
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: INTAKE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: intakeTools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tu of toolUses) {
        const result = await executeTool({
          name: tu.name as IntakeToolName,
          input: tu.input as Record<string, unknown>,
          state,
          conversationId: conversation.id,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result.toolReturnValue),
          is_error: result.isError,
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    finalReply = textBlock?.text?.trim() ?? "";
    break;
  }

  if (!finalReply) {
    finalReply =
      "Disculpa, tuve un problema procesando tu mensaje. ¿Me lo puedes repetir?";
    log.warn("agent_empty_reply", { conversation_id: conversation.id });
  }

  state.turns.push(
    { role: "user", content: input.userText, at: new Date().toISOString() },
    { role: "assistant", content: finalReply, at: new Date().toISOString() },
  );
  if (state.turns.length > 30) state.turns = state.turns.slice(-30);

  await saveConversationState(conversation.id, state);

  return { reply: finalReply };
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

interface ToolExecCtx {
  name: IntakeToolName;
  input: Record<string, unknown>;
  state: IntakeConversationState;
  conversationId: string;
}

interface ToolExecResult {
  toolReturnValue: unknown;
  isError?: boolean;
}

const STEP_ORDER: IntakeStep[] = [
  "ask_name",
  "ask_phone",
  "ask_description",
  "confirm",
  "done",
];

function nextStep(current: IntakeStep): IntakeStep {
  const idx = STEP_ORDER.indexOf(current);
  return idx >= 0 && idx < STEP_ORDER.length - 1
    ? STEP_ORDER[idx + 1]
    : "done";
}

async function executeTool(ctx: ToolExecCtx): Promise<ToolExecResult> {
  switch (ctx.name) {
    case "record_field":
      return executeRecordField(ctx);
    case "finalize_intake":
      return executeFinalizeIntake(ctx);
    case "escalate_to_human":
      return executeEscalateToHuman(ctx);
    default: {
      const _exhaustive: never = ctx.name;
      return {
        toolReturnValue: { error: `tool desconocida: ${_exhaustive}` },
        isError: true,
      };
    }
  }
}

async function executeRecordField(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const field = String(ctx.input.field ?? "").trim();
  const value = String(ctx.input.value ?? "").trim();

  if (!["name", "phone", "description"].includes(field)) {
    return {
      toolReturnValue: { error: `field invalido: ${field}` },
      isError: true,
    };
  }
  if (!value) {
    return {
      toolReturnValue: { error: "value vacio" },
      isError: true,
    };
  }

  if (field === "name") {
    ctx.state.collected.name = value.slice(0, 120);
    if (ctx.state.current_step === "ask_name") {
      ctx.state.current_step = nextStep(ctx.state.current_step);
    }
  } else if (field === "phone") {
    // Normalizamos a 521+10 digitos. Si el cliente da 10 digitos pelados
    // queda como 521xxxxxxxxxx, igual que como Evolution lo registra cuando
    // entra por webhook. Esto previene duplicados de customers.
    const normalized = normalizeMxWhatsApp(value);
    if (!normalized) {
      return {
        toolReturnValue: {
          error:
            "phone parece invalido (espera movil MX de 10 digitos). Pide aclaracion al cliente.",
        },
        isError: true,
      };
    }
    ctx.state.collected.phone = normalized;
    if (ctx.state.current_step === "ask_phone") {
      ctx.state.current_step = nextStep(ctx.state.current_step);
    }

    // Lookup en customers con el formato canonico (siempre va a matchear
    // si el cliente ya existe, sin importar como lo escribio en WhatsApp).
    const sb = supabaseServer();
    const { data: existing } = await sb
      .from("customers")
      .select("id, name")
      .eq("whatsapp_phone", normalized)
      .maybeSingle();
    if (existing) {
      ctx.state.matched_customer_id = existing.id;
      log.info("matched_existing_customer", {
        conversation_id: ctx.conversationId,
        customer_id: existing.id,
      });
    }
  } else if (field === "description") {
    ctx.state.collected.description = value.slice(0, 1000);
    if (ctx.state.current_step === "ask_description") {
      ctx.state.current_step = nextStep(ctx.state.current_step);
    }
  }

  return {
    toolReturnValue: {
      ok: true,
      recorded_field: field,
      next_step: ctx.state.current_step,
      prompt_hint:
        ctx.state.current_step === "confirm"
          ? "Tienes los 3 campos. Llama finalize_intake AHORA en este mismo turno."
          : `Sigue con el paso ${ctx.state.current_step}.`,
    },
  };
}

async function executeFinalizeIntake(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const c = ctx.state.collected;
  if (!c.name || !c.phone || !c.description) {
    return {
      toolReturnValue: {
        error:
          "Faltan campos. Aun no tienes los 3 (name, phone, description). Sigue recolectando.",
        missing: {
          name: !c.name,
          phone: !c.phone,
          description: !c.description,
        },
      },
      isError: true,
    };
  }

  const sb = supabaseServer();

  // 1. Resolver customer_id: usar el matched, o crear/upsert por phone.
  let customerId = ctx.state.matched_customer_id;
  if (!customerId) {
    const { data: upserted, error: upsertErr } = await sb
      .from("customers")
      .upsert(
        {
          whatsapp_phone: c.phone,
          name: c.name,
        },
        { onConflict: "whatsapp_phone", ignoreDuplicates: false },
      )
      .select("id")
      .single();
    if (upsertErr || !upserted) {
      log.error("upsert_customer_failed", { error: upsertErr?.message });
      return {
        toolReturnValue: {
          error: `db customer: ${upsertErr?.message ?? "unknown"}`,
        },
        isError: true,
      };
    }
    customerId = upserted.id;
  }

  // 2. Insertar service_intake_requests (status='pending_review').
  const { data: intake, error: intakeErr } = await sb
    .from("service_intake_requests")
    .insert({
      conversation_id: ctx.conversationId,
      customer_id: customerId,
      requested_name: c.name,
      requested_phone: c.phone,
      raw_request_description: c.description,
      status: "pending_review",
    })
    .select("id")
    .single();
  if (intakeErr || !intake) {
    log.error("insert_intake_failed", { error: intakeErr?.message });
    return {
      toolReturnValue: { error: `db intake: ${intakeErr?.message ?? "unknown"}` },
      isError: true,
    };
  }

  // 3. Mutar state, escalar conversacion y resetear agent_type a 'info' para
  //    cuando el humano reactive el bot.
  ctx.state.intake_request_id = intake.id;
  ctx.state.current_step = "done";
  ctx.state.handoff = { reason: "intake_completado", at: new Date().toISOString() };

  await sb
    .from("conversations")
    .update({ agent_type: "info" })
    .eq("id", ctx.conversationId);
  await markConversationStatus(ctx.conversationId, "escalated");

  return {
    toolReturnValue: {
      ok: true,
      intake_request_id: intake.id,
      customer_id: customerId,
      escalated: true,
      prompt_hint:
        "Tu mensaje al cliente debe ser exactamente: '¡Listo! Tu solicitud quedo registrada. En menos de 1 hora un asesor de itsMade te contacta para confirmar detalles. Mil gracias.'",
    },
  };
}

async function executeEscalateToHuman(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const reason = String(ctx.input.reason ?? "sin_motivo").trim() || "sin_motivo";

  const sb = supabaseServer();
  await sb
    .from("conversations")
    .update({ agent_type: "info" })
    .eq("id", ctx.conversationId);
  await markConversationStatus(ctx.conversationId, "escalated");

  ctx.state.handoff = { reason, at: new Date().toISOString() };

  return {
    toolReturnValue: {
      ok: true,
      escalated: true,
      reason,
      prompt_hint:
        "Tu mensaje al cliente: despidete brevemente con cortesia, algo como 'Te paso con un asesor de itsMade que te ayuda en breve. Mil gracias.'",
    },
  };
}
