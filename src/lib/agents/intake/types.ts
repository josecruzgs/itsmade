export type {
  IntakeConversationState,
  IntakeStep,
  IntakeCollected,
  ConversationTurn,
} from "@/lib/supabase/types";

export type IntakeToolName =
  | "record_field"
  | "finalize_intake"
  | "escalate_to_human";
