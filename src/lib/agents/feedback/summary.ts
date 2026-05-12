import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "@/lib/agents/_shared/anthropic";
import { createLogger } from "@/lib/logger";
import { FEEDBACK_QUESTIONS } from "@/lib/agents/feedback/types";
import type { FeedbackConversationState } from "@/lib/agents/feedback/types";

const log = createLogger("feedback-summary");

const SUMMARY_SYSTEM_PROMPT = `Eres un analista que escribe resúmenes ejecutivos en español (es-MX) para un panel administrativo de itsMade (servicios de limpieza profesional).

A partir de la transcripción de WhatsApp y las 5 respuestas estructuradas del cliente, produce un resumen claro y útil para el administrador.

Reglas:
- 3 a 5 oraciones, tono neutral y profesional.
- Cubre: sentimiento general, qué destacó positivamente, qué señaló como mejora (si algo), y si pidió contacto o algo accionable.
- Sin emojis, sin viñetas, sin encabezados. Solo texto plano corrido.
- No inventes datos. Si el cliente fue parco, dilo ("respuestas escuetas, sin observaciones puntuales").
- No repitas los scores numéricos textualmente; intégralos como interpretación cualitativa.`;

const QUESTION_LABELS: Record<number, string> = {
  1: "Satisfacción general",
  2: "Puntualidad",
  3: "Calidad del trabajo",
  4: "Trato del personal",
  5: "Comentario abierto",
};

/**
 * Genera un resumen ejecutivo de la conversación de feedback.
 * Falla silenciosa: si Anthropic truena, devuelve null y loguea warn.
 */
export async function buildFeedbackSummary(
  state: FeedbackConversationState,
): Promise<string | null> {
  try {
    const answersBlock = state.answers
      .map((a, i) => {
        if (!a) return `P${i + 1} (${QUESTION_LABELS[i + 1]}): [sin respuesta]`;
        const score =
          typeof a.normalized_score === "number"
            ? ` — score ${a.normalized_score}/5`
            : "";
        const text = a.normalized_text ? ` (limpio: "${a.normalized_text}")` : "";
        return `P${i + 1} (${QUESTION_LABELS[i + 1]})${score}: "${a.raw_answer}"${text}`;
      })
      .join("\n");

    const transcript = state.turns
      .map((t) => `${t.role === "user" ? "Cliente" : "Bot"}: ${t.content}`)
      .join("\n");

    const userContent = [
      "Preguntas del cuestionario:",
      ...FEEDBACK_QUESTIONS.map((q, i) => `  P${i + 1}: ${q.text}`),
      "",
      "Respuestas registradas:",
      answersBlock,
      "",
      "Transcripción completa de WhatsApp:",
      transcript || "[vacía]",
      "",
      "Escribe el resumen ahora.",
    ].join("\n");

    log.info("summary_call_start", {
      feedback_request_id: state.feedback_request_id,
      model: MODELS.feedback(),
      turns_count: state.turns.length,
      answers_count: state.answers.filter(Boolean).length,
    });

    const response = await anthropic().messages.create({
      model: MODELS.feedback(),
      max_tokens: 400,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      log.error("summary_empty_response", {
        feedback_request_id: state.feedback_request_id,
        stop_reason: response.stop_reason,
        content_blocks: response.content.map((b) => b.type),
      });
      return null;
    }

    log.info("summary_call_ok", {
      feedback_request_id: state.feedback_request_id,
      chars: text.length,
    });
    return text;
  } catch (err) {
    log.error("summary_generation_failed", {
      feedback_request_id: state.feedback_request_id,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 600) : undefined,
    });
    return null;
  }
}
