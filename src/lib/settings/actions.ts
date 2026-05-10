"use server";

import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { evolutionClient } from "@/lib/evolution/client";
import type { ActionResult } from "@/lib/auth/actions";

// =============================================================================
// Evolution API (WhatsApp)
// =============================================================================

export interface EvolutionStatus {
  state: "open" | "connecting" | "close" | "unknown";
  instanceName: string;
  apiUrl: string;
  managerUrl: string;
  number: string | null;
  profileName: string | null;
  profilePicture: string | null;
  qrBase64: string | null;
  pairingCode: string | null;
  reachable: boolean;
  errorMessage: string | null;
}

export async function getEvolutionStatus(): Promise<EvolutionStatus> {
  await requireAdmin();
  const e = env();
  const baseUrl = e.EVOLUTION_API_URL.replace(/\/$/, "");
  const status: EvolutionStatus = {
    state: "unknown",
    instanceName: e.EVOLUTION_INSTANCE_NAME,
    apiUrl: baseUrl,
    managerUrl: `${baseUrl}/manager`,
    number: null,
    profileName: null,
    profilePicture: null,
    qrBase64: null,
    pairingCode: null,
    reachable: false,
    errorMessage: null,
  };

  const evo = evolutionClient();
  try {
    status.state = await evo.getConnectionState();
    status.reachable = status.state !== "unknown";

    if (status.state === "open") {
      const info = await evo.fetchInstanceInfo();
      if (info) {
        status.number = info.number;
        status.profileName = info.profileName;
        status.profilePicture = info.profilePicture;
      }
    } else if (status.state === "close" || status.state === "connecting") {
      const qr = await evo.getQRCode();
      if (qr) {
        status.qrBase64 = qr.base64;
        status.pairingCode = qr.pairingCode;
      }
    }
  } catch (err) {
    status.errorMessage = (err as Error).message;
  }
  return status;
}

export async function logoutEvolution(): Promise<ActionResult> {
  await requireAdmin();
  try {
    await evolutionClient().logout();
    return { ok: true, message: "Dispositivo desvinculado." };
  } catch (e) {
    return { ok: false, error: `No se pudo desvincular: ${(e as Error).message}` };
  }
}

// =============================================================================
// Limpieza de base de datos
// =============================================================================

const CLOSED_CONVERSATION_STATUSES = ["closed", "escalated"] as const;

export interface CleanupCounts {
  messages: number;
  conversations: number;
}

function cutoffISO(hours: number): string {
  const d = new Date(Date.now() - hours * 3600 * 1000);
  return d.toISOString();
}

export async function getCleanupPreview(hours: number): Promise<CleanupCounts> {
  await requireAdmin();
  const h = Math.max(1, Math.min(8760, Math.floor(hours)));
  const cutoff = cutoffISO(h);
  const sb = supabaseServer();

  const [msgs, convs] = await Promise.all([
    sb
      .from("messages")
      .select("id", { count: "exact", head: true })
      .lt("created_at", cutoff),
    sb
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .lt("last_message_at", cutoff)
      .in("status", CLOSED_CONVERSATION_STATUSES as unknown as string[]),
  ]);

  return {
    messages: msgs.count ?? 0,
    conversations: convs.count ?? 0,
  };
}

export interface CleanupOptions {
  messages: boolean;
  conversations: boolean;
}

export type CleanupResult =
  | { ok: true; deleted: CleanupCounts; message: string }
  | { ok: false; error: string };

export async function executeCleanup(
  hours: number,
  options: CleanupOptions,
): Promise<CleanupResult> {
  await requireAdmin();
  const h = Math.max(1, Math.min(8760, Math.floor(hours)));
  const cutoff = cutoffISO(h);
  const sb = supabaseServer();
  const deleted: CleanupCounts = { messages: 0, conversations: 0 };

  try {
    // 1. Conversaciones cerradas/escaladas (CASCADE elimina sus messages).
    if (options.conversations) {
      const { count, error } = await sb
        .from("conversations")
        .delete({ count: "exact" })
        .lt("last_message_at", cutoff)
        .in("status", CLOSED_CONVERSATION_STATUSES as unknown as string[]);
      if (error) return { ok: false, error: `Conversaciones: ${error.message}` };
      deleted.conversations = count ?? 0;
    }

    // 2. Mensajes huerfanos antiguos (independiente del status de la conv).
    if (options.messages) {
      const { count, error } = await sb
        .from("messages")
        .delete({ count: "exact" })
        .lt("created_at", cutoff);
      if (error) return { ok: false, error: `Mensajes: ${error.message}` };
      deleted.messages = count ?? 0;
    }

    const total = deleted.messages + deleted.conversations;
    return {
      ok: true,
      deleted,
      message:
        total === 0
          ? "Nada para limpiar."
          : `Eliminados: ${deleted.conversations} conversaciones, ${deleted.messages} mensajes.`,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================================
// Info read-only para la pagina de settings
// =============================================================================

export async function getSettingsInfo() {
  await requireAdmin();
  const e = env();
  return {
    model: e.ANTHROPIC_MODEL,
    instanceName: e.EVOLUTION_INSTANCE_NAME,
    autoCloseHours: e.CONVERSATION_AUTO_CLOSE_HOURS,
    feedbackExpiryHours: e.FEEDBACK_REQUEST_EXPIRY_HOURS,
  };
}
