import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "@/lib/agents/_shared/anthropic";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import {
  saveConversationState,
  markConversationStatus,
} from "@/lib/conversation/state";
import type {
  AgentRunInput,
  AgentRunResult,
} from "@/lib/agents/registry";
import type {
  FeedbackConversationState,
  FeedbackToolName,
} from "@/lib/agents/feedback/types";
import { FEEDBACK_QUESTIONS } from "@/lib/agents/feedback/types";
import { feedbackTools } from "@/lib/agents/feedback/tools";
import { FEEDBACK_SYSTEM_PROMPT } from "@/lib/agents/feedback/prompt";
import { buildFeedbackSummary } from "@/lib/agents/feedback/summary";
import {
  isFeedbackState,
  injectStateContext,
} from "@/lib/agents/feedback/state";

const log = createLogger("feedback-agent");
const MAX_TOOL_ITERATIONS = 6;

/**
 * Ejecuta un turno del agente de feedback con tool use loop.
 * - Trabaja sobre una copia mutable del state.
 * - Slice de los ultimos 10 turnos al modelo, mantenemos hasta 30 en DB.
 * - Si la conversacion no tiene state de feedback (cold contact), responde silencio.
 */
export async function runFeedbackTurn(input: AgentRunInput): Promise<AgentRunResult> {
  const { conversation } = input;

  if (!isFeedbackState(conversation.state)) {
    log.info("cold_contact_no_feedback_state", {
      conversation_id: conversation.id,
      phone: conversation.whatsapp_phone,
    });
    // Silencio: el cliente escribió sin que existiera una solicitud de feedback abierta.
    // El admin verá el inbound en /conversations y decidirá.
    return { reply: "" };
  }

  const state: FeedbackConversationState = JSON.parse(
    JSON.stringify(conversation.state),
  ) as FeedbackConversationState;

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
      model: MODELS.feedback(),
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: FEEDBACK_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: feedbackTools,
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
          name: tu.name as FeedbackToolName,
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
      "Disculpa, tuve un problema con tu mensaje. ¿Me lo puedes repetir?";
    log.warn("agent_empty_reply", { conversation_id: conversation.id });
  }

  // Persistir turno y guardar state.
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
  name: FeedbackToolName;
  input: Record<string, unknown>;
  state: FeedbackConversationState;
  conversationId: string;
}

interface ToolExecResult {
  toolReturnValue: unknown;
  isError?: boolean;
}

async function executeTool(ctx: ToolExecCtx): Promise<ToolExecResult> {
  switch (ctx.name) {
    case "record_answer":
      return executeRecordAnswer(ctx);

    case "request_clarification":
      return executeRequestClarification(ctx);

    case "finalize_feedback":
      return executeFinalizeFeedback(ctx);

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

async function executeRecordAnswer(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const questionIndex = Number(ctx.input.question_index);
  const rawAnswer = String(ctx.input.raw_answer ?? "").trim();
  const normalizedScoreRaw = ctx.input.normalized_score;
  const normalizedScore =
    typeof normalizedScoreRaw === "number" &&
    normalizedScoreRaw >= 1 &&
    normalizedScoreRaw <= 5
      ? Math.round(normalizedScoreRaw)
      : undefined;
  const normalizedText =
    typeof ctx.input.normalized_text === "string"
      ? ctx.input.normalized_text.trim() || undefined
      : undefined;

  if (!Number.isInteger(questionIndex) || questionIndex < 1 || questionIndex > 5) {
    return {
      toolReturnValue: { error: "question_index debe ser entero 1-5" },
      isError: true,
    };
  }
  if (!rawAnswer) {
    return {
      toolReturnValue: { error: "raw_answer no puede estar vacio" },
      isError: true,
    };
  }

  const expected = ctx.state.current_question;
  // Si current_question es 0 (consent), aceptamos record_answer para Q1
  // (caso: el cliente saltó el consent y dio rating directo).
  const acceptableExpected = expected === 0 ? 1 : expected;
  if (questionIndex !== acceptableExpected) {
    return {
      toolReturnValue: {
        error: `question_index ${questionIndex} no coincide con la pregunta esperada`,
        expected_question_index: acceptableExpected,
      },
      isError: true,
    };
  }

  // Validar shape: P1-P4 deben tener score; P5 idealmente texto.
  if (questionIndex <= 4 && normalizedScore === undefined) {
    return {
      toolReturnValue: {
        error:
          "Para preguntas 1-4 (ratings) debes proveer normalized_score (1-5). Si la respuesta es ambigua, llama request_clarification en lugar de record_answer.",
      },
      isError: true,
    };
  }

  // Upsert en DB (idempotente).
  const sb = supabaseServer();
  const { error: upsertErr } = await sb.from("feedback_answers").upsert(
    {
      request_id: ctx.state.feedback_request_id,
      question_index: questionIndex,
      raw_answer: rawAnswer,
      normalized_score: normalizedScore ?? null,
      normalized_text: normalizedText ?? null,
    },
    { onConflict: "request_id,question_index" },
  );
  if (upsertErr) {
    return {
      toolReturnValue: { error: `db: ${upsertErr.message}` },
      isError: true,
    };
  }

  // Mutar state.
  ctx.state.answers[questionIndex - 1] = {
    raw_answer: rawAnswer,
    ...(normalizedScore !== undefined ? { normalized_score: normalizedScore } : {}),
    ...(normalizedText ? { normalized_text: normalizedText } : {}),
    at: new Date().toISOString(),
  };
  const nextIdx = (questionIndex + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  ctx.state.current_question = nextIdx as FeedbackConversationState["current_question"];
  ctx.state.awaiting =
    nextIdx <= 5 ? { kind: "answer", question_index: nextIdx } : null;

  // Si fue P5, no hay siguiente pregunta — el modelo debe llamar finalize_feedback.
  if (questionIndex === 5) {
    return {
      toolReturnValue: {
        ok: true,
        recorded: true,
        prompt_hint:
          "Llama finalize_feedback ahora. Después agradece brevemente y despídete.",
        finalize_now: true,
      },
    };
  }

  // Devolver el texto verbatim de la siguiente pregunta como prompt_hint.
  const nextQuestion = FEEDBACK_QUESTIONS[questionIndex]; // index questionIndex (no -1) porque queremos la SIGUIENTE
  return {
    toolReturnValue: {
      ok: true,
      recorded: true,
      next_question_index: questionIndex + 1,
      prompt_hint: `Tu mensaje al cliente: un agradecimiento de 1-4 palabras + texto exacto: "${nextQuestion.text}"`,
    },
  };
}

function executeRequestClarification(ctx: ToolExecCtx): ToolExecResult {
  const questionIndex = Number(ctx.input.question_index);
  const clarificationMessage = String(ctx.input.clarification_message ?? "").trim();

  if (!Number.isInteger(questionIndex) || questionIndex < 1 || questionIndex > 5) {
    return {
      toolReturnValue: { error: "question_index debe ser entero 1-5" },
      isError: true,
    };
  }
  if (!clarificationMessage) {
    return {
      toolReturnValue: { error: "clarification_message vacio" },
      isError: true,
    };
  }

  // Determinamos prior_raw a partir de los turns recientes (el ultimo user turn).
  const lastUser = [...ctx.state.turns].reverse().find((t) => t.role === "user");
  const priorRaw = lastUser?.content ?? "";

  ctx.state.awaiting = {
    kind: "clarification",
    question_index: questionIndex,
    prior_raw: priorRaw.slice(0, 500),
  };

  return {
    toolReturnValue: {
      ok: true,
      prompt_hint: `Tu mensaje al cliente debe ser exactamente: "${clarificationMessage}"`,
    },
  };
}

async function executeFinalizeFeedback(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const lastAnswer = ctx.state.answers[4];
  if (ctx.state.current_question < 6 || !lastAnswer) {
    return {
      toolReturnValue: {
        error:
          "Aún no has registrado las 5 respuestas. Continúa con la siguiente pregunta usando record_answer.",
        current_question: ctx.state.current_question,
      },
      isError: true,
    };
  }

  // Calcular promedio de P1-P4 (solo respuestas con score valido).
  const ratings = ctx.state.answers
    .slice(0, 4)
    .map((a) => a?.normalized_score)
    .filter((s): s is number => typeof s === "number" && s >= 1 && s <= 5);

  if (ratings.length === 0) {
    return {
      toolReturnValue: {
        error: "No hay scores validos para calcular promedio.",
      },
      isError: true,
    };
  }

  const avg = ratings.reduce((sum, n) => sum + n, 0) / ratings.length;
  const scoreOverallAvg = Math.round(avg * 10) / 10;
  const npsBucket: "promoter" | "passive" | "detractor" =
    scoreOverallAvg >= 4.5
      ? "promoter"
      : scoreOverallAvg >= 3.5
        ? "passive"
        : "detractor";

  const sb = supabaseServer();
  const nowIso = new Date().toISOString();

  // Resumen generado por LLM. Falla silenciosa: si truena, summary queda null.
  const summary = await buildFeedbackSummary(ctx.state);

  const { error: frErr } = await sb
    .from("feedback_requests")
    .update({
      status: "completed",
      completed_at: nowIso,
      score_overall_avg: scoreOverallAvg,
      nps_bucket: npsBucket,
      summary,
      summary_generated_at: summary ? nowIso : null,
    })
    .eq("id", ctx.state.feedback_request_id);
  if (frErr) {
    log.error("finalize_update_request_failed", { error: frErr.message });
    return {
      toolReturnValue: { error: `db request: ${frErr.message}` },
      isError: true,
    };
  }

  await markConversationStatus(ctx.conversationId, "closed");

  return {
    toolReturnValue: {
      ok: true,
      score_overall_avg: scoreOverallAvg,
      nps_bucket: npsBucket,
      prompt_hint:
        "Tu mensaje al cliente: agradecimiento breve y despedida. Algo como '¡Listo! Mil gracias por tu tiempo, esto nos ayuda a mejorar. ¡Que tengas excelente día!'",
    },
  };
}

async function executeEscalateToHuman(ctx: ToolExecCtx): Promise<ToolExecResult> {
  const reason = String(ctx.input.reason ?? "sin_motivo").trim() || "sin_motivo";

  await markConversationStatus(ctx.conversationId, "escalated");
  ctx.state.handoff = { reason, at: new Date().toISOString() };

  const sb = supabaseServer();
  await sb
    .from("feedback_requests")
    .update({ status: "escalated" })
    .eq("id", ctx.state.feedback_request_id);

  return {
    toolReturnValue: {
      ok: true,
      escalated: true,
      reason,
      prompt_hint:
        "Tu mensaje al cliente: despídete brevemente con cortesía, algo como 'Lo lamento mucho. Un asesor de itsMade te contactará pronto.'",
    },
  };
}
