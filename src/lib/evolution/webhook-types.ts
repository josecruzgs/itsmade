/**
 * Tipos del payload del webhook de Evolution API v2.
 * Solo modelamos lo que consumimos: el evento `messages.upsert` con mensajes
 * entrantes (key.fromMe === false) de tipo texto, imagen y audio.
 *
 * Referencia: https://doc.evolution-api.com/v2/api-reference/webhook
 */

export interface EvolutionWebhookKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
}

export interface EvolutionTextMessage {
  conversation?: string;
  extendedTextMessage?: { text: string };
}

export interface EvolutionImageMessage {
  imageMessage?: {
    url?: string;
    mimetype?: string;
    caption?: string;
    fileSha256?: string;
    fileLength?: string | number;
    height?: number;
    width?: number;
    mediaKey?: string;
    fileEncSha256?: string;
    directPath?: string;
    mediaKeyTimestamp?: string;
    jpegThumbnail?: string;
    /** Algunas configuraciones de Evolution incluyen el binario en base64. */
    base64?: string;
  };
}

export interface EvolutionAudioMessage {
  audioMessage?: {
    url?: string;
    mimetype?: string;
    seconds?: number;
    base64?: string;
  };
}

export interface EvolutionDocumentMessage {
  documentMessage?: {
    url?: string;
    mimetype?: string;
    title?: string;
    fileName?: string;
    base64?: string;
  };
}

export type EvolutionMessageContent = EvolutionTextMessage &
  EvolutionImageMessage &
  EvolutionAudioMessage &
  EvolutionDocumentMessage;

export interface EvolutionMessageData {
  key: EvolutionWebhookKey;
  pushName?: string;
  message?: EvolutionMessageContent;
  messageType?: string;
  messageTimestamp?: number | string;
  instanceId?: string;
  source?: string;
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessageData;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

/**
 * Estructura normalizada que pasamos al ConversationRouter.
 */
export interface InboundMessage {
  evolutionMessageId: string;
  fromPhone: string; // numero E.164 sin +
  pushName: string | null; // nombre del contacto en WhatsApp
  type: "text" | "image" | "audio" | "document" | "unsupported";
  text: string | null; // contenido textual (caption en imagen, conversation en texto)
  mediaBase64: string | null; // base64 del binario si Evolution lo entrega
  mediaUrl: string | null; // URL si esta disponible
  mimetype: string | null;
  rawType: string | null;
  timestamp: number;
}

export function extractInboundMessage(payload: EvolutionWebhookPayload): InboundMessage | null {
  const data = payload.data;
  if (!data?.key?.id) return null;
  if (data.key.fromMe) return null;

  const remoteJid = data.key.remoteJid ?? "";
  // Filtramos grupos: terminan en `@g.us`. Solo procesamos chats individuales.
  if (remoteJid.endsWith("@g.us")) return null;

  const fromPhone = remoteJid.split("@")[0]?.replace(/\D/g, "") ?? "";
  if (!fromPhone) return null;

  const msg = data.message ?? {};
  const messageType = data.messageType ?? "";
  const ts =
    typeof data.messageTimestamp === "string"
      ? Number.parseInt(data.messageTimestamp, 10)
      : data.messageTimestamp ?? Date.now() / 1000;

  const base: Omit<InboundMessage, "type" | "text" | "mediaBase64" | "mediaUrl" | "mimetype"> = {
    evolutionMessageId: data.key.id,
    fromPhone,
    pushName: data.pushName ?? null,
    rawType: messageType || null,
    timestamp: typeof ts === "number" ? ts : 0,
  };

  // Texto plano
  const plainText = msg.conversation ?? msg.extendedTextMessage?.text ?? null;
  if (plainText) {
    return {
      ...base,
      type: "text",
      text: plainText,
      mediaBase64: null,
      mediaUrl: null,
      mimetype: null,
    };
  }

  // Imagen (con caption opcional)
  if (msg.imageMessage) {
    return {
      ...base,
      type: "image",
      text: msg.imageMessage.caption ?? null,
      mediaBase64: msg.imageMessage.base64 ?? null,
      mediaUrl: msg.imageMessage.url ?? null,
      mimetype: msg.imageMessage.mimetype ?? "image/jpeg",
    };
  }

  // Audio
  if (msg.audioMessage) {
    return {
      ...base,
      type: "audio",
      text: null,
      mediaBase64: msg.audioMessage.base64 ?? null,
      mediaUrl: msg.audioMessage.url ?? null,
      mimetype: msg.audioMessage.mimetype ?? "audio/ogg",
    };
  }

  // Documento (PDF u otros)
  if (msg.documentMessage) {
    return {
      ...base,
      type: "document",
      text: null,
      mediaBase64: msg.documentMessage.base64 ?? null,
      mediaUrl: msg.documentMessage.url ?? null,
      mimetype: msg.documentMessage.mimetype ?? "application/octet-stream",
    };
  }

  return {
    ...base,
    type: "unsupported",
    text: null,
    mediaBase64: null,
    mediaUrl: null,
    mimetype: null,
  };
}
