import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tools del agente info. Minimal: solo escalate.
 * El agente no persiste datos estructurados, solo conversa con la info que
 * tiene en company-knowledge.md.
 */
export const infoTools: Anthropic.Tool[] = [
  {
    name: "start_intake",
    description:
      "Dispara el flujo de registro de solicitud de servicio cuando el cliente expresa " +
      "intencion clara de contratar o cotizar (ej: 'quiero un servicio', 'quiero cotizar', " +
      "'me pueden ir a limpiar', 'cuanto cuesta lavar mi sala', 'agendame'). " +
      "Tras llamar esta tool, la conversacion pasa al agente intake. " +
      "Tu mensaje siguiente debe presentar el flujo en una linea, ej: 'Perfecto. Para registrarte, ¿como te llamas?'. " +
      "NO la llames si el cliente solo esta preguntando informacion general sobre servicios — espera a que pida contratar.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "escalate_to_human",
    description:
      "Escala la conversacion a un humano cuando: " +
      "(a) el cliente pide explicitamente hablar con una persona, " +
      "(b) reporta un problema con un servicio ya prestado, " +
      "(c) hay agresividad sostenida del cliente. " +
      "NO la uses para 'quiero un servicio' / 'cotizar' — para eso usa start_intake.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Motivo breve (ej: 'pidio_humano', 'queja', 'fuera_de_alcance'). Texto libre.",
        },
      },
      required: ["reason"],
    },
  },
];
