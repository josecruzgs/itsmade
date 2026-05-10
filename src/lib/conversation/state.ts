import { supabaseServer } from "@/lib/supabase/server";
import type {
  AgentType,
  ConversationRow,
  ConversationState,
  ConversationStatus,
} from "@/lib/supabase/types";

interface ConversationRowDb {
  id: string;
  customer_id: string | null;
  whatsapp_phone: string;
  agent_type: AgentType;
  status: ConversationStatus;
  state: ConversationState | null;
  last_message_at: string;
  created_at: string;
}

/**
 * Carga la conversacion abierta del cliente o crea una nueva.
 * Tambien crea/actualiza el registro de cliente si no existe.
 *
 * Una conversacion "abierta" es cualquiera con status NOT IN ('closed').
 * Si la conversacion esta escalada, igual la devuelve (el router decide
 * que hacer con ese caso).
 */
export async function getOrCreateConversation(opts: {
  whatsappPhone: string;
  pushName?: string | null;
  /** Tipo de agente a asignar si se crea conversacion nueva. Default: 'feedback'. */
  agentType?: AgentType;
  /** State inicial si se crea conversacion nueva. Default: {}. */
  initialState?: ConversationState;
}): Promise<ConversationRow> {
  const sb = supabaseServer();
  const agentType: AgentType = opts.agentType ?? "info";

  // Upsert ligero del cliente.
  const { data: customer } = await sb
    .from("customers")
    .upsert(
      {
        whatsapp_phone: opts.whatsappPhone,
        ...(opts.pushName ? { name: opts.pushName } : {}),
      },
      { onConflict: "whatsapp_phone", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  // Buscamos cualquier conversacion no cerrada (incluye escalated).
  const { data: existing, error: fetchErr } = await sb
    .from("conversations")
    .select("*")
    .eq("whatsapp_phone", opts.whatsappPhone)
    .in("status", ["active", "awaiting_response", "escalated"])
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) {
    return normalizeConversation(existing as ConversationRowDb);
  }

  const { data: created, error: insertErr } = await sb
    .from("conversations")
    .insert({
      customer_id: customer?.id ?? null,
      whatsapp_phone: opts.whatsappPhone,
      agent_type: agentType,
      status: "active",
      state: (opts.initialState ?? {}) as ConversationState,
    })
    .select("*")
    .single();

  if (insertErr || !created) {
    throw insertErr ?? new Error("no se pudo crear conversacion");
  }
  return normalizeConversation(created as ConversationRowDb);
}

export async function saveConversationState(
  conversationId: string,
  state: ConversationState,
) {
  const sb = supabaseServer();
  const { error } = await sb
    .from("conversations")
    .update({ state, last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function markConversationStatus(
  conversationId: string,
  status: ConversationStatus,
) {
  const sb = supabaseServer();
  await sb.from("conversations").update({ status }).eq("id", conversationId);
}

export async function attachCustomerToConversation(opts: {
  conversationId: string;
  customerName?: string;
  notes?: string;
}) {
  if (!opts.customerName && !opts.notes) return;
  const sb = supabaseServer();
  const { data: conv } = await sb
    .from("conversations")
    .select("customer_id")
    .eq("id", opts.conversationId)
    .single();
  if (!conv?.customer_id) return;
  await sb
    .from("customers")
    .update({
      ...(opts.customerName ? { name: opts.customerName } : {}),
      ...(opts.notes ? { notes: opts.notes } : {}),
    })
    .eq("id", conv.customer_id);
}

/**
 * Recarga una conversacion despues de mutaciones (ej: tras tool calls del agente
 * que actualizan state desde otras rutas).
 */
export async function reloadConversation(conversationId: string): Promise<ConversationRow> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (error || !data) throw error ?? new Error("conversation not found");
  return normalizeConversation(data as ConversationRowDb);
}

function normalizeConversation(row: ConversationRowDb): ConversationRow {
  return {
    ...row,
    state: (row.state ?? {}) as ConversationState,
  };
}
