import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tools del agente intake.
 *
 * Flujo: el agente llama record_field paso a paso (name → phone → description),
 * y cuando los 3 estan llenos llama finalize_intake. escalate_to_human es la
 * salida de emergencia.
 */
export const intakeTools: Anthropic.Tool[] = [
  {
    name: "record_field",
    description:
      "Registra UNO de los campos pedidos: 'name', 'phone' o 'description'. " +
      "Llamar cuando la respuesta del cliente sea claramente interpretable. " +
      "Para 'phone': normaliza a digitos sin espacios (ej. '5614111234' o '+525614111234'). " +
      "Si el campo recolectado coincide con current_step, el state avanza al siguiente. " +
      "Si el cliente da los 3 datos en un solo mensaje, llamala 3 veces seguidas en el mismo turno.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: ["name", "phone", "description"],
          description: "Cual de los 3 campos esta registrando.",
        },
        value: {
          type: "string",
          description:
            "Valor capturado. Para 'name', el nombre tal como lo dio. Para 'phone', solo digitos (puede empezar con + para internacional). Para 'description', un resumen breve de lo que necesita.",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "finalize_intake",
    description:
      "Cierra la solicitud despues de tener los 3 campos (name, phone, description). " +
      "Crea/recupera el customer por telefono, inserta service_intake_requests con status='pending_review', " +
      "escala la conversacion (status='escalated') y la marca para que un humano la atienda. " +
      "Tras llamar esta tool, despidete al cliente con la promesa de contacto en menos de 1 hora.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "escalate_to_human",
    description:
      "Salida de emergencia. Llamar SOLO si: " +
      "(a) el cliente pide explicitamente hablar con persona antes de terminar el intake, " +
      "(b) hay agresividad sostenida, " +
      "(c) el cliente reporta una queja de un servicio anterior (pertenece a otro flujo). " +
      "NO la uses solo porque tarde el cliente en contestar — ahi solo espera el siguiente turno.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Motivo breve (ej: 'pidio_humano', 'agresivo', 'queja_de_servicio_pasado').",
        },
      },
      required: ["reason"],
    },
  },
];
