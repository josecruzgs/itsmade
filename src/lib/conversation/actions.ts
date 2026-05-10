"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { evolutionClient } from "@/lib/evolution/client";
import { recordOutgoing } from "@/lib/conversation/messages";
import type { ConversationState } from "@/lib/supabase/types";

/**
 * Reactiva una conversacion escalada para que el bot vuelva a atenderla.
 * Limpia el flag handoff del state si existe y deja status='active'.
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

  // Limpia handoff sin pisar el resto del state (puede ser cualquier shape de agente).
  const currentState = (conv.state ?? {}) as Record<string, unknown>;
  const newState: ConversationState = {
    ...currentState,
    handoff: null,
  } as ConversationState;

  await sb
    .from("conversations")
    .update({ status: "active", state: newState })
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
