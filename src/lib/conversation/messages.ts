import { supabaseServer } from "@/lib/supabase/server";
import type { MessageRole } from "@/lib/supabase/types";

export interface RecordIncomingArgs {
  conversationId: string;
  evolutionMessageId: string;
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  rawType: string | null;
}

/**
 * Inserta un mensaje entrante. Idempotente via evolution_message_id unique.
 * Devuelve true si se inserto, false si ya existia (mensaje duplicado del webhook).
 */
export async function recordIncoming(args: RecordIncomingArgs): Promise<boolean> {
  const sb = supabaseServer();
  const { error } = await sb.from("messages").insert({
    conversation_id: args.conversationId,
    role: "user" as MessageRole,
    content: args.text,
    media_url: args.mediaUrl,
    media_type: args.mediaType,
    evolution_message_id: args.evolutionMessageId,
    metadata: { raw_type: args.rawType },
  });
  if (error) {
    // 23505 = unique violation: ya lo procesamos.
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

export async function recordOutgoing(args: {
  conversationId: string;
  text: string;
  evolutionMessageId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("messages")
    .insert({
      conversation_id: args.conversationId,
      role: "assistant" as MessageRole,
      content: args.text,
      evolution_message_id: args.evolutionMessageId ?? null,
      metadata: args.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function recordSystemNote(args: {
  conversationId: string;
  text: string;
  metadata?: Record<string, unknown>;
}) {
  const sb = supabaseServer();
  await sb.from("messages").insert({
    conversation_id: args.conversationId,
    role: "system" as MessageRole,
    content: args.text,
    metadata: args.metadata ?? {},
  });
}
