import type {
  FeedbackConversationState,
  FeedbackAwaiting,
} from "@/lib/agents/feedback/types";

export { isFeedbackState } from "@/lib/supabase/types";

/**
 * Crea el state inicial para una nueva conversacion de feedback.
 * El admin lo invoca desde el server action `requestFeedback` justo antes
 * de mandar el mensaje opening por WhatsApp.
 */
export function emptyFeedbackState(seed: {
  feedback_request_id: string;
  service_job_id: string;
}): FeedbackConversationState {
  return {
    feedback_request_id: seed.feedback_request_id,
    service_job_id: seed.service_job_id,
    current_question: 0,
    answers: [null, null, null, null, null],
    awaiting: { kind: "consent" },
    handoff: null,
    turns: [],
  };
}

/**
 * Genera un bloque corto que se prepende al mensaje del usuario antes de mandar
 * al modelo. Incluye solo el estado relevante para que el agente decida que tool
 * llamar (current_question, awaiting, ultima respuesta).
 *
 * El bloque va dentro del rol "user" como un prefijo entre [corchetes] para que
 * el modelo lo distinga visualmente del texto real del cliente.
 */
export function injectStateContext(state: FeedbackConversationState): string {
  const lines: string[] = [];
  lines.push(`current_question: ${state.current_question}`);
  lines.push(`awaiting: ${describeAwaiting(state.awaiting)}`);

  // Adjuntamos las respuestas ya recolectadas (compacto).
  const recorded = state.answers
    .map((a, i) => {
      if (!a) return null;
      const score = a.normalized_score ?? "n/a";
      return `Q${i + 1}=${score} (raw: "${a.raw_answer.slice(0, 40)}")`;
    })
    .filter(Boolean);
  if (recorded.length > 0) {
    lines.push(`already_recorded: ${recorded.join(" | ")}`);
  }

  return `[Estado de la encuesta]\n${lines.join("\n")}`;
}

function describeAwaiting(a: FeedbackAwaiting): string {
  if (!a) return "none";
  if (a.kind === "consent") return "consent (esperando que el cliente acepte iniciar)";
  if (a.kind === "answer") return `answer (esperando respuesta a P${a.question_index})`;
  if (a.kind === "clarification") {
    return `clarification (P${a.question_index} — el cliente respondió ambiguo: "${a.prior_raw.slice(0, 40)}")`;
  }
  return "unknown";
}
