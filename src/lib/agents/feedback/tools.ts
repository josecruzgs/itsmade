import type Anthropic from "@anthropic-ai/sdk";

/**
 * Definiciones de tools para el agente de feedback.
 *
 * El input_schema sigue JSON Schema; Claude las llama con esos parametros.
 * La validacion runtime y el efecto en DB ocurren en `agent.ts` (executeTool).
 */
export const feedbackTools: Anthropic.Tool[] = [
  {
    name: "record_answer",
    description:
      "Registra la respuesta del cliente para una pregunta especifica. " +
      "Llamar SOLO cuando la respuesta sea claramente interpretable. " +
      "Para preguntas 1-4 (ratings), pasar `normalized_score` (1-5) basado en la tabla de normalizacion. " +
      "Para pregunta 5 (comentario libre), pasar `normalized_text` (texto limpio). " +
      "El executor valida que `question_index` coincida con la pregunta esperada; " +
      "si te equivocas, recibiras un is_error con la pregunta correcta.",
    input_schema: {
      type: "object",
      properties: {
        question_index: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Numero de pregunta (1-5) que se esta contestando.",
        },
        raw_answer: {
          type: "string",
          description: "Texto verbatim del cliente, sin modificar.",
        },
        normalized_score: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Score 1-5 normalizado (solo para preguntas 1-4).",
        },
        normalized_text: {
          type: "string",
          description: "Texto limpio del comentario (solo para pregunta 5).",
        },
      },
      required: ["question_index", "raw_answer"],
    },
  },
  {
    name: "request_clarification",
    description:
      "Pide aclaracion cortes cuando la respuesta es genuinamente ambigua " +
      "(ej: 'depende', 'no sé', contradiccion, evasiva). NO avanza a la siguiente pregunta. " +
      "Usar SOLO cuando la respuesta no se pueda mapear a 1-5 con la tabla de normalizacion.",
    input_schema: {
      type: "object",
      properties: {
        question_index: { type: "integer", minimum: 1, maximum: 5 },
        clarification_message: {
          type: "string",
          description:
            "Texto en es-MX que enviarás al cliente pidiendo aclaracion. Breve, amable, una linea.",
        },
      },
      required: ["question_index", "clarification_message"],
    },
  },
  {
    name: "finalize_feedback",
    description:
      "Cierra la encuesta tras recolectar las 5 respuestas. " +
      "Calcula el promedio de P1-P4, asigna NPS bucket (promoter/passive/detractor), " +
      "marca el feedback_request como completed y cierra la conversacion. " +
      "Llamar SOLO despues de un record_answer exitoso de la pregunta 5.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "escalate_to_human",
    description:
      "Escala la conversacion a un humano. Usar cuando: " +
      "(a) el cliente reporta queja grave (daño, robo, agresion), " +
      "(b) solicita reembolso o devolucion, " +
      "(c) pide explicitamente hablar con una persona, " +
      "(d) hay agresividad sostenida del cliente. " +
      "Tras llamar esta tool, despídete con cortesia y NO sigas el guion.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Motivo breve (ej: 'queja_grave', 'reembolso', 'pidio_humano', 'agresivo'). Texto libre.",
        },
      },
      required: ["reason"],
    },
  },
];
