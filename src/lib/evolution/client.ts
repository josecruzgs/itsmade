import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("evolution");

export interface SendTextOptions {
  number: string;
  text: string;
  delayMs?: number;
}

export interface SendMediaOptions {
  number: string;
  mediaUrl: string;
  fileName: string;
  caption?: string;
  mimetype?: string;
  /** 'document' para PDFs, 'image' para JPG/PNG. */
  mediatype?: "document" | "image" | "video";
}

export interface DownloadMediaOptions {
  /** ID del mensaje (key.id) que llego en el webhook. */
  messageId: string;
  /** remoteJid del chat (ej: 5215512345678@s.whatsapp.net). */
  remoteJid: string;
  /** Si true, recibimos base64 en respuesta (default true). */
  convertToMp4?: boolean;
}

/**
 * Cliente REST minimo para Evolution API v2.
 * Documentacion: https://doc.evolution-api.com/v2/api-reference
 */
export class EvolutionClient {
  private baseUrl: string;
  private apiKey: string;
  private instance: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string; instance?: string }) {
    const e = env();
    this.baseUrl = (opts?.baseUrl ?? e.EVOLUTION_API_URL).replace(/\/$/, "");
    this.apiKey = opts?.apiKey ?? e.EVOLUTION_API_KEY;
    this.instance = opts?.instance ?? e.EVOLUTION_INSTANCE_NAME;
  }

  private async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.error("evolution_request_failed", {
        method,
        path,
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new Error(`Evolution API ${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  /**
   * Envia texto plano. POST /message/sendText/{instance}
   */
  async sendText(opts: SendTextOptions) {
    return this.request<{ key?: { id?: string } }>(
      "POST",
      `/message/sendText/${this.instance}`,
      {
        number: opts.number,
        text: opts.text,
        delay: opts.delayMs,
      },
    );
  }

  /**
   * Envia media por URL. POST /message/sendMedia/{instance}
   */
  async sendMedia(opts: SendMediaOptions) {
    return this.request("POST", `/message/sendMedia/${this.instance}`, {
      number: opts.number,
      mediatype: opts.mediatype ?? "document",
      mimetype: opts.mimetype ?? "application/pdf",
      caption: opts.caption,
      media: opts.mediaUrl,
      fileName: opts.fileName,
    });
  }

  /**
   * Descarga el binario de un mensaje en base64.
   * POST /chat/getBase64FromMediaMessage/{instance}
   */
  async downloadMediaBase64(opts: DownloadMediaOptions): Promise<{ base64: string; mimetype: string } | null> {
    try {
      const res = await this.request<{ base64?: string; mimetype?: string }>(
        "POST",
        `/chat/getBase64FromMediaMessage/${this.instance}`,
        {
          message: { key: { id: opts.messageId, remoteJid: opts.remoteJid } },
          convertToMp4: opts.convertToMp4 ?? false,
        },
      );
      if (!res?.base64) return null;
      return { base64: res.base64, mimetype: res.mimetype ?? "application/octet-stream" };
    } catch (err) {
      log.warn("download_media_failed", { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Marca un chat como leido. POST /chat/markMessageAsRead/{instance}
   */
  async markAsRead(opts: { remoteJid: string; messageId: string }) {
    try {
      await this.request("POST", `/chat/markMessageAsRead/${this.instance}`, {
        readMessages: [
          {
            remoteJid: opts.remoteJid,
            id: opts.messageId,
            fromMe: false,
          },
        ],
      });
    } catch (err) {
      log.warn("mark_as_read_failed", { error: (err as Error).message });
    }
  }

  /**
   * Indicador "escribiendo..." durante la generacion de respuesta.
   */
  async sendPresence(opts: { number: string; presence: "composing" | "available" | "paused"; delayMs?: number }) {
    try {
      await this.request("POST", `/chat/sendPresence/${this.instance}`, {
        number: opts.number,
        presence: opts.presence,
        delay: opts.delayMs ?? 1200,
      });
    } catch {
      // No critico.
    }
  }

  // ===========================================================================
  // Instance management (estado, QR, logout)
  // ===========================================================================

  /**
   * Estado de la conexion. GET /instance/connectionState/{instance}
   * Devuelve "open" (conectado), "connecting" o "close" (desconectado).
   */
  async getConnectionState(): Promise<"open" | "connecting" | "close" | "unknown"> {
    try {
      const res = await this.request<{ instance?: { state?: string }; state?: string }>(
        "GET",
        `/instance/connectionState/${this.instance}`,
      );
      const state = res?.instance?.state ?? res?.state ?? "unknown";
      if (state === "open" || state === "connecting" || state === "close") return state;
      return "unknown";
    } catch (err) {
      log.warn("connection_state_failed", { error: (err as Error).message });
      return "unknown";
    }
  }

  /**
   * Solicita el QR / pairing code. GET /instance/connect/{instance}
   * Solo retorna QR si la instancia esta desconectada o conectando.
   */
  async getQRCode(): Promise<{
    base64: string | null;
    pairingCode: string | null;
    code: string | null;
  } | null> {
    try {
      const res = await this.request<{
        base64?: string;
        pairingCode?: string;
        code?: string;
      }>("GET", `/instance/connect/${this.instance}`);
      return {
        base64: res?.base64 ?? null,
        pairingCode: res?.pairingCode ?? null,
        code: res?.code ?? null,
      };
    } catch (err) {
      log.warn("get_qr_failed", { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Desvincula el dispositivo. DELETE /instance/logout/{instance}
   */
  async logout(): Promise<void> {
    await this.request("DELETE", `/instance/logout/${this.instance}`);
  }

  /**
   * Detalles de la instancia (numero, nombre de perfil).
   */
  async fetchInstanceInfo(): Promise<{
    profileName: string | null;
    profilePicture: string | null;
    ownerJid: string | null;
    number: string | null;
  } | null> {
    try {
      const res = await this.request<unknown>(
        "GET",
        `/instance/fetchInstances?instanceName=${encodeURIComponent(this.instance)}`,
      );
      const item = Array.isArray(res) ? res[0] : res;
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const inner = (o.instance as Record<string, unknown> | undefined) ?? o;
      const ownerJid =
        (inner.ownerJid as string | undefined) ??
        (inner.owner as string | undefined) ??
        null;
      const number = ownerJid ? ownerJid.split("@")[0]?.replace(/\D/g, "") || null : null;
      return {
        profileName:
          (inner.profileName as string | undefined) ??
          (o.profileName as string | undefined) ??
          null,
        profilePicture:
          (inner.profilePictureUrl as string | undefined) ??
          (o.profilePictureUrl as string | undefined) ??
          null,
        ownerJid,
        number,
      };
    } catch (err) {
      log.warn("fetch_instance_info_failed", { error: (err as Error).message });
      return null;
    }
  }
}

let cached: EvolutionClient | null = null;
export function evolutionClient(): EvolutionClient {
  if (!cached) cached = new EvolutionClient();
  return cached;
}

/**
 * Limpia el cliente cacheado para forzar re-creacion con env actualizado.
 * Util tras actualizar API key o URL en /settings.
 */
export function resetEvolutionClient(): void {
  cached = null;
}
