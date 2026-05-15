// =============================================================================
// Tipos manuales que reflejan el esquema de Supabase (migraciones 0001+0002+0003).
// Mantener sincronizado a mano con supabase/migrations/*.sql.
// =============================================================================

// -----------------------------------------------------------------------------
// Enums (reflejan los CHECK constraints / postgres enums de la migración)
// -----------------------------------------------------------------------------

export type ServiceJobStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ConversationStatus =
  | "active"
  | "awaiting_response"
  | "closed"
  | "escalated";

export type MessageRole = "user" | "assistant" | "system" | "tool";

/** Discriminator del agente que opera la conversación.
 *  Ampliable: agregar el nuevo nombre aquí + en el CHECK constraint
 *  de `conversations.agent_type` con una migración nueva. */
export type AgentType = "feedback" | "info" | "intake";

export type FeedbackRequestStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "expired"
  | "escalated"
  | "cancelled";

export type IntakeRequestStatus =
  | "pending_review"
  | "in_review"
  | "converted"
  | "dismissed";

export type NpsBucket = "promoter" | "passive" | "detractor";

export type ImprovementReportStatus = "pending" | "applied";

export type UserRole = "admin" | "user";

export type ServiceCategorySlug = "residencial" | "comercial" | "industrial";

// -----------------------------------------------------------------------------
// Estado polimórfico de conversación (jsonb conversations.state)
// -----------------------------------------------------------------------------

export interface FeedbackAnswerEntry {
  raw_answer: string;
  normalized_score?: number; // 1..5, presente para Q1-Q4
  normalized_text?: string; // presente para Q5
  at: string; // ISO
}

export type FeedbackAwaiting =
  | { kind: "consent" }
  | { kind: "answer"; question_index: number }
  | { kind: "clarification"; question_index: number; prior_raw: string }
  | null;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface FeedbackConversationState {
  feedback_request_id: string;
  service_job_id: string;
  current_question: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  answers: Array<FeedbackAnswerEntry | null>; // length 5
  awaiting: FeedbackAwaiting;
  handoff: { reason: string; at: string } | null;
  turns: ConversationTurn[]; // últimas 30 en DB; modelo recibe últimas 10
}

/** Estado del agente `info` — concierge para preguntas generales.
 *  No tiene flujo estructurado; solo arrastra historial y handoff opcional. */
export interface InfoConversationState {
  kind: "info"; // discriminador
  handoff: { reason: string; at: string } | null;
  turns: ConversationTurn[];
}

/** Estado del agente `intake` — registra la solicitud de servicio.
 *  Captura paso a paso: nombre → celular → descripción breve → finaliza. */
export type IntakeStep =
  | "ask_name"
  | "ask_phone"
  | "ask_description"
  | "confirm"
  | "done";

export interface IntakeCollected {
  name: string | null;
  phone: string | null;
  description: string | null;
}

export interface IntakeConversationState {
  kind: "intake"; // discriminador
  current_step: IntakeStep;
  collected: IntakeCollected;
  /** Si el celular capturado matchea un customer existente, su id. */
  matched_customer_id: string | null;
  /** id del registro en service_intake_requests creado al finalizar. */
  intake_request_id: string | null;
  handoff: { reason: string; at: string } | null;
  turns: ConversationTurn[];
}

/** Estado vacío inicial — útil para conversaciones recién creadas que aún
 *  no fueron inicializadas por su agente. */
export type EmptyConversationState = Record<string, never>;

/** Unión discriminada para todos los tipos de estado posibles.
 *  Las funciones consumidoras deben hacer narrow con type guards. */
export type ConversationState =
  | FeedbackConversationState
  | InfoConversationState
  | IntakeConversationState
  | EmptyConversationState;

// -----------------------------------------------------------------------------
// Filas de tablas
// -----------------------------------------------------------------------------

export interface BranchRow {
  id: string;
  name: string;
  city: string;
  state: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export interface ServiceCategoryRow {
  id: string;
  slug: ServiceCategorySlug;
  name: string;
  description: string | null;
}

export interface ServiceRow {
  id: string;
  code: string;
  name: string;
  category_id: string;
  description: string | null;
  base_price_mxn: number | null;
  active: boolean;
  created_at: string;
}

export interface CustomerRow {
  id: string;
  whatsapp_phone: string;
  name: string | null;
  email: string | null;
  company_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceJobRow {
  id: string;
  customer_id: string;
  branch_id: string;
  service_id: string;
  scheduled_at: string | null;
  completed_at: string | null;
  status: ServiceJobStatus;
  notes: string | null;
  address: string | null;
  cost_mxn: number | null;
  metadata: Record<string, unknown>;
  assigned_employee_id: string | null;
  pdf_sent_at: string | null;
  created_at: string;
}

export interface EmployeeRow {
  id: string;
  full_name: string;
  position: string | null;
  area: string | null;
  whatsapp_phone: string;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  customer_id: string | null;
  whatsapp_phone: string;
  agent_type: AgentType;
  status: ConversationStatus;
  state: ConversationState;
  last_message_at: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  evolution_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FeedbackRequestRow {
  id: string;
  service_job_id: string;
  customer_id: string;
  branch_id: string;
  service_id: string;
  conversation_id: string | null;
  requested_by_profile_id: string | null;
  opening_message_id: string | null;
  status: FeedbackRequestStatus;
  score_overall_avg: number | null;
  nps_bucket: NpsBucket | null;
  sent_at: string | null;
  completed_at: string | null;
  expired_at: string | null;
  summary: string | null;
  summary_generated_at: string | null;
  analyzed_in_report_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImprovementReportRow {
  id: string;
  generated_at: string;
  generated_by_profile_id: string | null;
  feedback_count: number;
  report_markdown: string;
  status: ImprovementReportStatus;
  applied_at: string | null;
  applied_by_profile_id: string | null;
  applied_notes: string | null;
}

export interface FeedbackAnswerRow {
  id: string;
  request_id: string;
  question_index: number; // 1..5
  raw_answer: string;
  normalized_score: number | null;
  normalized_text: string | null;
  answered_at: string;
}

export interface ServiceIntakeRequestRow {
  id: string;
  conversation_id: string;
  customer_id: string;
  requested_name: string;
  requested_phone: string;
  raw_request_description: string | null;
  status: IntakeRequestStatus;
  assigned_to_profile_id: string | null;
  service_job_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Type guards
// -----------------------------------------------------------------------------

export function isFeedbackState(
  state: ConversationState | null | undefined,
): state is FeedbackConversationState {
  if (!state || typeof state !== "object") return false;
  return (
    "feedback_request_id" in state &&
    "current_question" in state &&
    Array.isArray((state as FeedbackConversationState).answers)
  );
}

export function isInfoState(
  state: ConversationState | null | undefined,
): state is InfoConversationState {
  if (!state || typeof state !== "object") return false;
  return (state as InfoConversationState).kind === "info";
}

export function isIntakeState(
  state: ConversationState | null | undefined,
): state is IntakeConversationState {
  if (!state || typeof state !== "object") return false;
  return (state as IntakeConversationState).kind === "intake";
}
