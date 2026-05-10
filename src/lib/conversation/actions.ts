"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { evolutionClient } from "@/lib/evolution/client";
import { recordOutgoing } from "@/lib/conversation/messages";
import type { ConversationState } from "@/lib/supabase/types";

/**
 * Reactiva una conversacion escalada para que el bot vuelva a atenderla.
 * Resetea agent_type a 'info' y state a `{ kind: 'info', turns: [...] }`,
 * preservando el historial de turns que se haya capturado.
 *
 * Por que resetear: si la conversacion fue escalada desde un intake completado,
 * agent_type quedo en 'info' y state en intake-shape; si fue desde feedback
 * escalado, ambas en feedback. Al reactivar, el bot debe poder responder dudas
 * generales del cliente, no continuar el flujo previo.
 */
export async function reactivateBot(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = supabaseServer();

  const { data: conv } = await sb
    .from("conversations")
    .select("id, state")
    .eq("id", id)
    .single();
  if (!conv) return;

  // Preservar turns si existen (historial conversacional). Discartar resto del state.
  const currentState = (conv.state ?? {}) as Record<string, unknown>;
  const turns = Array.isArray(currentState.turns) ? currentState.turns : [];
  const newState: ConversationState = {
    kind: "info",
    handoff: null,
    turns,
  } as ConversationState;

  await sb
    .from("conversations")
    .update({ status: "active", agent_type: "info", state: newState })
    .eq("id", id);

  revalidatePath("/conversations");
}

/**
 * Cierra una conversacion sin reactivar el bot.
 * El cliente puede iniciar una nueva conversacion despues con un mensaje.
 */
export async function closeConversation(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const sb = supabaseServer();
  await sb.from("conversations").update({ status: "closed" }).eq("id", id);
  revalidatePath("/conversations");
}

/**
 * Envia un mensaje manual desde el panel al cliente via Evolution.
 * Util cuando un humano esta atendiendo una conversacion escalada.
 */
export async function sendManualMessage(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!id || !text) return;

  const sb = supabaseServer();
  const { data: conv } = await sb
    .from("conversations")
    .select("id, whatsapp_phone")
    .eq("id", id)
    .single();
  if (!conv) return;

  const evo = evolutionClient();
  const sent = await evo.sendText({
    number: `${conv.whatsapp_phone}@s.whatsapp.net`,
    text,
  });
  await recordOutgoing({
    conversationId: id,
    text,
    evolutionMessageId: sent?.key?.id ?? null,
    metadata: { sent_by: "human" },
  });
  revalidatePath("/conversations");
}
