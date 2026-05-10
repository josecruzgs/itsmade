// Re-exporta los tipos canonicos del state (definidos en supabase/types) para que
// el agente importe desde un solo lugar.
export type {
  FeedbackConversationState,
  FeedbackAnswerEntry,
  FeedbackAwaiting,
  ConversationTurn,
} from "@/lib/supabase/types";

export interface FeedbackQuestionDef {
  index: 1 | 2 | 3 | 4 | 5;
  text: string;
  kind: "rating" | "free_text";
}

/**
 * Las 5 preguntas en orden. Texto verbatim que el agente envia.
 */
export const FEEDBACK_QUESTIONS: readonly FeedbackQuestionDef[] = [
  {
    index: 1,
    text: "¿Cómo calificarías el servicio en general, del 1 al 5?",
    kind: "rating",
  },
  {
    index: 2,
    text: "¿Qué tan puntual fue el equipo? (1 al 5)",
    kind: "rating",
  },
  {
    index: 3,
    text: "¿Cómo evalúas la calidad de la limpieza? (1 al 5)",
    kind: "rating",
  },
  {
    index: 4,
    text: "¿Qué tal el trato del personal? (1 al 5)",
    kind: "rating",
  },
  {
    index: 5,
    text: "Por último, ¿algún comentario o sugerencia? Cualquier detalle nos ayuda.",
    kind: "free_text",
  },
] as const;

export type FeedbackToolName =
  | "record_answer"
  | "request_clarification"
  | "finalize_feedback"
  | "escalate_to_human";
