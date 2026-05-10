// Re-exporta los tipos canonicos del state (definidos en supabase/types) para que
// el agente importe desde un solo lugar.
export type {
  InfoConversationState,
  ConversationTurn,
} from "@/lib/supabase/types";

export type InfoToolName = "escalate_to_human" | "start_intake";
