import { after, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import {
  extractInboundMessage,
  type EvolutionWebhookPayload,
} from "@/lib/evolution/webhook-types";
import { handleInboundMessage } from "@/lib/conversation/router";

const log = createLogger("webhook");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Punto de entrada del webhook de Evolution API.
 *
 * Estrategia:
 * 1) Validamos la apikey (header `apikey` o body.apikey segun version de Evolution).
 * 2) Devolvemos 200 lo antes posible para que Evolution no reintente.
 * 3) El procesamiento real (IA, Supabase, envio de respuesta) corre en `after()`
 *    para no bloquear la respuesta del webhook.
 */
export async function POST(req: Request) {
  const e = env();

  const headerKey = req.headers.get("apikey") ?? req.headers.get("x-api-key");

  let payload: EvolutionWebhookPayload;
  try {
    payload = (await req.json()) as EvolutionWebhookPayload;
  } catch (err) {
    log.warn("invalid_json_body", { error: (err as Error).message });
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Evolution v2 firma los webhooks con el token por-instancia, v1 con la global.
  // Aceptamos cualquiera de los dos por header o body.
  const bodyKey = payload?.apikey;
  const validKey =
    headerKey === e.EVOLUTION_API_KEY ||
    bodyKey === e.EVOLUTION_API_KEY ||
    (e.EVOLUTION_INSTANCE_TOKEN !== undefined && bodyKey === e.EVOLUTION_INSTANCE_TOKEN) ||
    (e.EVOLUTION_INSTANCE_TOKEN !== undefined && headerKey === e.EVOLUTION_INSTANCE_TOKEN);
  const validInstance =
    !payload?.instance || payload.instance === e.EVOLUTION_INSTANCE_NAME;
  if (!validKey || !validInstance) {
    log.warn("unauthorized_webhook", { event: payload?.event });
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Solo procesamos messages.upsert. Connection updates u otros se aceptan y se ignoran.
  const eventName = (payload.event ?? "").toLowerCase().replace(/_/g, ".");
  if (eventName !== "messages.upsert") {
    return NextResponse.json({ ok: true, ignored: eventName });
  }

  const inbound = extractInboundMessage(payload);
  if (!inbound) {
    return NextResponse.json({ ok: true, ignored: "non_actionable" });
  }

  // Procesamos despues de responder.
  after(async () => {
    try {
      await handleInboundMessage(inbound);
    } catch (err) {
      log.error("after_processing_failed", {
        error: (err as Error).message,
        evolution_message_id: inbound.evolutionMessageId,
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    service: "itsmade-webhook",
    status: "ready",
    docs: "POST aqui desde Evolution API con event=messages.upsert",
  });
}
