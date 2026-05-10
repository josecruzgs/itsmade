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
  InfoConversationState,
  InfoToolName,
} from "@/lib/agents/info/types";
import { infoTools } from "@/lib/agents/info/tools";
import { buildInfoSystemPrompt } from "@/lib/agents/info/prompt";
import { getInfoTurns } from "@/lib/agents/info/state";
import { emptyIntakeState } from "@/lib/agents/intake/state";

const log = createLogger("info-agent");
const MAX_TOOL_ITERATIONS = 4;

/**
 * Ejecuta un turno del agente info.
 * - Tolera state vacio (primera interaccion).
 * - Slice ultimos 10 turnos al modelo, mantenemos hasta 30 en DB.
 */
export async function runInfoTurn(input: AgentRunInput): Promise<AgentRunResult> {
  const { conversation } = input;

  // El state puede venir como {} (recien creada) o como InfoConversationState.
  // En cualquier caso construimos uno fresco preservando los turns existentes.
  const priorTurns = getInfoTurns(conversation.state);
  const state: InfoConversationState = {
    kind: "info",
    handoff:
      "handoff" in conversation.state &&
      (conversation.state as InfoConversationState).handoff
        ? (conversation.state as InfoConversationState).handoff
        : null,
    turns: [...priorTurns],
  };

  const history = state.turns.slice(-10);
  const messages: Anthropic.MessageParam[] = [
    ...history.map(
      (t): Anthropic.MessageParam => ({
        role: t.role,
        content: t.content,
      }),
    ),
    { role: "user", content: input.userText },
  ];

  let finalReply = "";
  // start_intake cambia agent_type+state en DB. Si paso, NO sobreescribimos
  // ese cambio con saveConversationState al final del turno.
  let switchedAgent = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic().messages.create({
      model: MODELS.info(),
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: buildInfoSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: infoTools,
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
          name: tu.name as InfoToolName,
          input: tu.input as Record<string, unknown>,
          state,
          conversationId: conversation.id,
        });
        if (result.switchedAgent) switchedAgent = true;
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
      "Disculpa, no logre procesar tu mensaje. ¿Me lo puedes repetir?";
    log.warn("agent_empty_reply", { conversation_id: conversation.id });
  }

  if (switchedAgent) {
    // El tool start_intake ya escribio el nuevo agent_type + state en DB.
    // Saltamos saveConversationState para no pisar ese cambio. El proximo
    // mensaje del cliente lo atendera el agente nuevo con state fresco.
    return { reply: finalReply };
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
  name: InfoToolName;
  input: Record<string, unknown>;
  state: InfoConversationState;
  conversationId: string;
}

interface ToolExecResult {
  toolReturnValue: unknown;
  isError?: boolean;
  /** Indica que el tool cambio agent_type/state en DB y la capa superior
   *  no debe sobreescribir con su propio save. */
  switchedAgent?: boolean;
}

async function executeTool(ctx: ToolExecCtx): Promise<ToolExecResult> {
  switch (ctx.name) {
    case "escalate_to_human":
      return executeEscalateToHuman(ctx);
    case "start_intake":
      return executeStartIntake(ctx);

    default: {
      const _exhaustive: never = ctx.name;
      return {
        toolReturnValue: { error: `tool desconocida: ${_exhaustive}` },
        isError: true,
      };
    }
  }
}

async function executeEscalateToHuman(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const reason = String(ctx.input.reason ?? "sin_motivo").trim() || "sin_motivo";

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

/**
 * Cambia la conversacion al agente intake. El proximo mensaje del cliente
 * sera atendido por runIntakeTurn que arranca pidiendo el nombre.
 *
 * Importante: el state del info se descarta y se reemplaza por emptyIntakeState.
 * Esto rompe el historial de turns para el modelo intake (nuevo agente, nuevo
 * contexto), pero los mensajes siguen visibles en /conversations.
 */
async function executeStartIntake(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const sb = supabaseServer();
  await sb
    .from("conversations")
    .update({ agent_type: "intake", state: emptyIntakeState() })
    .eq("id", ctx.conversationId);

  return {
    switchedAgent: true,
    toolReturnValue: {
      ok: true,
      switched_to: "intake",
      prompt_hint:
        "Tu mensaje al cliente: una linea calida que abra el flujo. Algo como '¡Perfecto! Para registrarte, ¿como te llamas?' — el cliente ya esta listo para dar su nombre.",
    },
  };
}
