import type { InfoConversationState } from "@/lib/agents/info/types";
import type { ConversationState, ConversationTurn } from "@/lib/supabase/types";

export { isInfoState } from "@/lib/supabase/types";

/**
 * State inicial para una conversacion del agente info.
 * El info no tiene flujo estructurado: solo arrastra el historial de turns.
 */
export function emptyInfoState(): InfoConversationState {
  return {
    kind: "info",
    handoff: null,
    turns: [],
  };
}

/**
 * Recupera los turns del state actual de la conversacion.
 * Tolera state vacio ({}) o cualquier shape inesperado — devuelve [].
 */
export function getInfoTurns(state: ConversationState | null | undefined): ConversationTurn[] {
  if (!state || typeof state !== "object") return [];
  if (!("turns" in state)) return [];
  const turns = (state as { turns?: unknown }).turns;
  return Array.isArray(turns) ? (turns as ConversationTurn[]) : [];
}
