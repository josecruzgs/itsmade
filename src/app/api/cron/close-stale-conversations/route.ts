import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";

const log = createLogger("cron-close-stale");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diario que cierra conversaciones inactivas por mas de
 * CONVERSATION_AUTO_CLOSE_HOURS. Solo afecta conversaciones en status
 * 'active' o 'awaiting_response' (las escaladas/closed se respetan).
 *
 * Disparado por Vercel Cron a las 10:00 UTC (configurado en vercel.json).
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
  const cutoffMs = Date.now() - e.CONVERSATION_AUTO_CLOSE_HOURS * 3600 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const { data, error } = await sb
    .from("conversations")
    .update({ status: "closed" })
    .lt("last_message_at", cutoffIso)
    .in("status", ["active", "awaiting_response"])
    .select("id");

  if (error) {
    log.error("close_stale_failed", { error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const closed = data?.length ?? 0;
  log.info("closed_batch", { count: closed, hours: e.CONVERSATION_AUTO_CLOSE_HOURS });
  return NextResponse.json({
    ok: true,
    closed,
    hours: e.CONVERSATION_AUTO_CLOSE_HOURS,
    cutoff: cutoffIso,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
