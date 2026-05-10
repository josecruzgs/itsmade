import { createLogger } from "@/lib/logger";
import { evolutionClient } from "@/lib/evolution/client";
import type { InboundMessage } from "@/lib/evolution/webhook-types";
import { dispatchAgent } from "@/lib/agents/registry";
import {
  getOrCreateConversation,
} from "@/lib/conversation/state";
import {
  recordIncoming,
  recordOutgoing,
} from "@/lib/conversation/messages";

const log = createLogger("router");

/**
 * Punto de entrada del flujo inbound.
 *
 * 1. Resuelve/crea la conversacion (upserta cliente).
 * 2. Idempotencia por evolution_message_id.
 * 3. Si la conversacion esta escalada, registra el mensaje pero no responde.
 * 4. Despacha al agente correspondiente segun `conversation.agent_type`.
 * 5. Envia respuesta y registra outbound.
 */
export async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  const evo = evolutionClient();
  const numberJid = `${msg.fromPhone}@s.whatsapp.net`;

  // Default a 'info' (concierge para preguntas generales). Cuando el admin
  // dispara "Solicitar feedback", la action sobreescribe a 'feedback' con el
  // state inicial correspondiente.
  const conversation = await getOrCreateConversation({
    whatsappPhone: msg.fromPhone,
    pushName: msg.pushName,
    agentType: "info",
  });

  // Idempotencia: si el webhook nos llego dos veces no procesamos otra vez.
  const mediaType: "image" | "audio" | "document" | null =
    msg.type === "image" || msg.type === "audio" || msg.type === "document"
      ? msg.type
      : null;
  const recorded = await recordIncoming({
    conversationId: conversation.id,
    evolutionMessageId: msg.evolutionMessageId,
    text: msg.text,
    mediaUrl: msg.mediaUrl,
    mediaType,
    rawType: msg.rawType,
  });
  if (!recorded) {
    log.info("duplicate_inbound_skipped", { id: msg.evolutionMessageId });
    return;
  }

  // HANDOFF: si la conversacion esta escalada a un humano, NO respondemos.
  // El mensaje queda registrado para que el admin lo vea desde /conversations.
  // Volvera a responder cuando un admin haga "Reactivar bot".
  if (conversation.status === "escalated") {
    log.info("inbound_skipped_escalated", {
      conversation_id: conversation.id,
      phone: msg.fromPhone,
    });
    return;
  }

  // Indicamos "escribiendo..." mientras procesamos.
  await evo.sendPresence({ number: msg.fromPhone, presence: "composing" });

  let reply = "";

  try {
    if (msg.type === "text" && msg.text) {
      const handler = dispatchAgent(conversation.agent_type);
      const result = await handler({ conversation, userText: msg.text });
      reply = result.reply;
    } else if (msg.type === "image") {
      reply =
        "Recibí tu foto, pero por aquí solo necesito tu respuesta a las preguntas. ¿Continuamos?";
    } else if (msg.type === "audio") {
      reply =
        "Por ahora solo puedo leer texto. ¿Me podrías escribir tu respuesta?";
    } else if (msg.type === "document") {
      reply =
        "Recibí tu documento, pero aquí solo proceso texto. ¿Me lo podrías escribir?";
    } else {
      reply =
        "Recibí tu mensaje, pero no pude leerlo. ¿Me lo podrías mandar como texto?";
    }
  } catch (err) {
    log.error("turn_failed", {
      error: (err as Error).message,
      conversation_id: conversation.id,
      agent_type: conversation.agent_type,
    });
    reply =
      "Tuve un problema procesando tu mensaje. Inténtalo de nuevo en un momento, por favor.";
  } finally {
    await evo.sendPresence({ number: msg.fromPhone, presence: "available" });
  }

  if (reply) {
    try {
      const sent = await evo.sendText({ number: numberJid, text: reply });
      await recordOutgoing({
        conversationId: conversation.id,
        text: reply,
        evolutionMessageId: sent?.key?.id ?? null,
      });
    } catch (err) {
      log.error("send_text_failed", { error: (err as Error).message });
    }
  }
}
