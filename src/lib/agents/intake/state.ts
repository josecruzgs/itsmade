import type {
  IntakeConversationState,
  IntakeStep,
} from "@/lib/agents/intake/types";

export { isIntakeState } from "@/lib/supabase/types";

/**
 * State inicial del agente intake. Se inserta cuando el agente `info` decide
 * disparar el flujo via su tool `start_intake`.
 */
export function emptyIntakeState(): IntakeConversationState {
  return {
    kind: "intake",
    current_step: "ask_name",
    collected: {
      name: null,
      phone: null,
      description: null,
    },
    matched_customer_id: null,
    intake_request_id: null,
    handoff: null,
    turns: [],
  };
}

const STEP_HINT: Record<IntakeStep, string> = {
  ask_name: "Necesitas preguntar el NOMBRE del cliente.",
  ask_phone: "Necesitas preguntar el CELULAR de contacto.",
  ask_description:
    "Necesitas preguntar QUE NECESITA en una sola pregunta abierta (tipo de espacio, tipo de servicio, fecha tentativa).",
  confirm: "Ya tienes los 3 campos. Llama finalize_intake.",
  done: "El intake ya se finalizo. No deberias estar aqui — escala si el cliente sigue escribiendo.",
};

/**
 * Bloque corto que se prepende al user message para que el modelo sepa
 * en que paso esta y que datos ya recolecto.
 */
export function injectStateContext(state: IntakeConversationState): string {
  const lines: string[] = [];
  lines.push(`current_step: ${state.current_step}`);
  lines.push(`hint: ${STEP_HINT[state.current_step]}`);

  const c = state.collected;
  const filled: string[] = [];
  if (c.name) filled.push(`name="${c.name}"`);
  if (c.phone) filled.push(`phone="${c.phone}"`);
  if (c.description) filled.push(`description="${c.description.slice(0, 80)}"`);
  if (filled.length > 0) {
    lines.push(`already_collected: ${filled.join(" | ")}`);
  }

  if (state.matched_customer_id) {
    lines.push(
      `matched_customer: si (telefono ya existe en la base; reusaremos su perfil)`,
    );
  }

  return `[Estado del intake]\n${lines.join("\n")}`;
}
