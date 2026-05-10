import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";

const log = createLogger("cron-expire-feedback");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diario que marca como 'expired' las solicitudes de feedback que
 * llevan mas de FEEDBACK_REQUEST_EXPIRY_HOURS sin respuesta del cliente.
 * Tambien cierra la conversacion asociada.
 *
 * Disparado por Vercel Cron a las 09:00 UTC (configurado en vercel.json).
 * En produccion exige el header `Authorization: Bearer ${CRON_SECRET}`.
 * En desarrollo local (sin CRON_SECRET) acepta llamadas sin auth.
 */
async function handle(req: Request) {
  const e = env();
  if (e.CRON_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${e.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const sb = supabaseServer();
  const cutoffMs = Date.now() - e.FEEDBACK_REQUEST_EXPIRY_HOURS * 3600 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  // 1. Encontrar las solicitudes que cumplen el criterio + sus conversation_ids.
  const { data: stale, error: selectErr } = await sb
    .from("feedback_requests")
    .select("id, conversation_id")
    .in("status", ["pending", "in_progress"])
    .not("sent_at", "is", null)
    .lt("sent_at", cutoffIso);

  if (selectErr) {
    log.error("select_failed", { error: selectErr.message });
    return NextResponse.json({ ok: false, error: selectErr.message }, { status: 500 });
  }

  const ids = (stale ?? []).map((r) => r.id);
  const conversationIds = (stale ?? [])
    .map((r) => r.conversation_id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, expired: 0, hours: e.FEEDBACK_REQUEST_EXPIRY_HOURS });
  }

  // 2. Marcar como expired.
  const nowIso = new Date().toISOString();
  const { error: updErr } = await sb
    .from("feedback_requests")
    .update({ status: "expired", expired_at: nowIso })
    .in("id", ids);
  if (updErr) {
    log.error("update_failed", { error: updErr.message });
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // 3. Cerrar conversaciones asociadas.
  if (conversationIds.length > 0) {
    await sb
      .from("conversations")
      .update({ status: "closed" })
      .in("id", conversationIds);
  }

  log.info("expired_batch", { count: ids.length, hours: e.FEEDBACK_REQUEST_EXPIRY_HOURS });
  return NextResponse.json({
    ok: true,
    expired: ids.length,
    closed_conversations: conversationIds.length,
    hours: e.FEEDBACK_REQUEST_EXPIRY_HOURS,
    cutoff: cutoffIso,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
