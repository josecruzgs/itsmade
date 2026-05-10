"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { evolutionClient } from "@/lib/evolution/client";
import { recordOutgoing } from "@/lib/conversation/messages";
import { getOrCreateConversation } from "@/lib/conversation/state";
import { emptyFeedbackState } from "@/lib/agents/feedback/state";
import { createLogger } from "@/lib/logger";
import type { ActionResult } from "@/lib/auth/actions";

const log = createLogger("feedback-actions");

interface ServiceJobJoined {
  id: string;
  status: string;
  customer: { id: string; name: string | null; whatsapp_phone: string };
  branch: { id: string; name: string; city: string };
  service: { id: string; name: string };
}

async function loadServiceJob(serviceJobId: string): Promise<ServiceJobJoined | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("service_jobs")
    .select(
      `
      id, status,
      customer:customers!service_jobs_customer_id_fkey(id, name, whatsapp_phone),
      branch:branches!service_jobs_branch_id_fkey(id, name, city),
      service:services!service_jobs_service_id_fkey(id, name)
      `,
    )
    .eq("id", serviceJobId)
    .single<{
      id: string;
      status: string;
      customer: { id: string; name: string | null; whatsapp_phone: string } | null;
      branch: { id: string; name: string; city: string } | null;
      service: { id: string; name: string } | null;
    }>();
  if (error || !data || !data.customer || !data.branch || !data.service) {
    return null;
  }
  return data as ServiceJobJoined;
}

function buildOpeningMessage(opts: {
  customerName: string | null;
  serviceName: string;
  branchCity: string;
}): string {
  const greeting = opts.customerName
    ? `Hola ${opts.customerName.trim().split(/\s+/)[0]}`
    : "Hola";
  return (
    `${greeting}, somos itsMade. Gracias por elegirnos para tu servicio de ${opts.serviceName} en ${opts.branchCity}. ` +
    `¿Tienes 1 minuto para 5 preguntas rápidas que nos ayudan a mejorar?`
  );
}

/**
 * Crea una solicitud de feedback y dispara el opening message por WhatsApp.
 *
 * Flujo:
 *  1. Inserta `feedback_requests` (status='pending').
 *  2. Crea/recupera conversation con agent_type='feedback' y state inicial.
 *  3. Actualiza la request con conversation_id.
 *  4. Envia el mensaje opening via Evolution.
 *  5. Si todo OK, marca status='in_progress' y guarda sent_at + opening_message_id.
 *
 * Si Evolution falla, la request queda en 'pending' con sent_at=NULL — el panel
 * mostrara un boton "Reintentar envio".
 */
export async function requestFeedback(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireAuth();

  const serviceJobId = String(formData.get("service_job_id") ?? "").trim();
  if (!serviceJobId) {
    return { ok: false, error: "service_job_id requerido" };
  }

  const job = await loadServiceJob(serviceJobId);
  if (!job) {
    return { ok: false, error: "Servicio no encontrado o incompleto." };
  }

  if (job.status !== "completed") {
    return {
      ok: false,
      error: "Solo se puede solicitar feedback de servicios completados.",
    };
  }

  const sb = supabaseServer();

  // 1. Insertar request en pending (el unique partial index nos protege de duplicados).
  const { data: request, error: insertErr } = await sb
    .from("feedback_requests")
    .insert({
      service_job_id: job.id,
      customer_id: job.customer.id,
      branch_id: job.branch.id,
      service_id: job.service.id,
      requested_by_profile_id: me.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !request) {
    if (insertErr?.code === "23505") {
      return {
        ok: false,
        error: "Ya hay una solicitud de feedback abierta para este servicio.",
      };
    }
    log.error("insert_request_failed", { error: insertErr?.message });
    return { ok: false, error: insertErr?.message ?? "No se pudo crear la solicitud." };
  }

  // 2. Crear/recuperar conversacion con state inicial de feedback.
  const conversation = await getOrCreateConversation({
    whatsappPhone: job.customer.whatsapp_phone,
    pushName: job.customer.name,
    agentType: "feedback",
    initialState: emptyFeedbackState({
      feedback_request_id: request.id,
      service_job_id: job.id,
    }),
  });

  // Si la conversacion ya existia, sobreescribimos su state al feedback nuevo.
  // Esto es OK porque conversaciones previas de feedback ya completadas estan en
  // status='closed' y no se reusan; si se llega aqui es porque hay una conversacion
  // abierta del mismo cliente que aun no se cerro.
  if (
    conversation.agent_type !== "feedback" ||
    !("feedback_request_id" in conversation.state) ||
    (conversation.state as Record<string, unknown>).feedback_request_id !== request.id
  ) {
    const newState = emptyFeedbackState({
      feedback_request_id: request.id,
      service_job_id: job.id,
    });
    await sb
      .from("conversations")
      .update({ state: newState, status: "active", agent_type: "feedback" })
      .eq("id", conversation.id);
  }

  await sb
    .from("feedback_requests")
    .update({ conversation_id: conversation.id })
    .eq("id", request.id);

  // 3. Enviar opening por WhatsApp.
  const openingText = buildOpeningMessage({
    customerName: job.customer.name,
    serviceName: job.service.name,
    branchCity: job.branch.city,
  });

  try {
    const evo = evolutionClient();
    const sent = await evo.sendText({
      number: `${job.customer.whatsapp_phone}@s.whatsapp.net`,
      text: openingText,
    });

    const outboundMsg = await recordOutgoing({
      conversationId: conversation.id,
      text: openingText,
      evolutionMessageId: sent?.key?.id ?? null,
      metadata: { kind: "feedback_opening", feedback_request_id: request.id },
    });

    await sb
      .from("feedback_requests")
      .update({
        status: "in_progress",
        sent_at: new Date().toISOString(),
        opening_message_id: outboundMsg?.id ?? null,
      })
      .eq("id", request.id);

    revalidatePath("/services");
    revalidatePath("/feedback");
    return {
      ok: true,
      message: `Solicitud enviada a ${job.customer.whatsapp_phone}.`,
    };
  } catch (err) {
    log.error("send_opening_failed", {
      error: (err as Error).message,
      feedback_request_id: request.id,
    });
    revalidatePath("/services");
    revalidatePath("/feedback");
    return {
      ok: false,
      error:
        "La solicitud quedó creada pero no se pudo enviar el WhatsApp. Verifica la conexión de Evolution e intenta reenviar desde /feedback.",
    };
  }
}

/**
 * Reintenta el envio del opening cuando una solicitud quedo en 'pending'/'in_progress'
 * sin sent_at (Evolution fallo en el primer intento).
 */
export async function retrySendFeedback(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const requestId = String(formData.get("id") ?? "").trim();
  if (!requestId) return { ok: false, error: "id requerido" };

  const sb = supabaseServer();

  const { data: req, error: reqErr } = await sb
    .from("feedback_requests")
    .select(
      `
      id, status, sent_at, conversation_id,
      customer:customers!feedback_requests_customer_id_fkey(id, name, whatsapp_phone),
      service:services!feedback_requests_service_id_fkey(id, name),
      branch:branches!feedback_requests_branch_id_fkey(id, city)
      `,
    )
    .eq("id", requestId)
    .single<{
      id: string;
      status: string;
      sent_at: string | null;
      conversation_id: string | null;
      customer: { id: string; name: string | null; whatsapp_phone: string } | null;
      service: { id: string; name: string } | null;
      branch: { id: string; city: string } | null;
    }>();

  if (reqErr || !req || !req.customer || !req.service || !req.branch) {
    return { ok: false, error: "Solicitud no encontrada o incompleta." };
  }
  if (req.sent_at) {
    return { ok: false, error: "Esta solicitud ya fue enviada." };
  }
  if (!req.conversation_id) {
    return { ok: false, error: "La solicitud no tiene conversación asociada." };
  }

  const openingText = buildOpeningMessage({
    customerName: req.customer.name,
    serviceName: req.service.name,
    branchCity: req.branch.city,
  });

  try {
    const evo = evolutionClient();
    const sent = await evo.sendText({
      number: `${req.customer.whatsapp_phone}@s.whatsapp.net`,
      text: openingText,
    });
    const outboundMsg = await recordOutgoing({
      conversationId: req.conversation_id,
      text: openingText,
      evolutionMessageId: sent?.key?.id ?? null,
      metadata: { kind: "feedback_opening_retry", feedback_request_id: req.id },
    });
    await sb
      .from("feedback_requests")
      .update({
        status: "in_progress",
        sent_at: new Date().toISOString(),
        opening_message_id: outboundMsg?.id ?? null,
      })
      .eq("id", req.id);
    revalidatePath("/feedback");
    return { ok: true, message: "Mensaje reenviado." };
  } catch (err) {
    log.error("retry_send_failed", { error: (err as Error).message, id: req.id });
    return {
      ok: false,
      error: `No se pudo reenviar: ${(err as Error).message}`,
    };
  }
}

/**
 * Cancela una solicitud que aun no fue completada.
 * Tambien cierra la conversacion si esta abierta.
 */
export async function cancelFeedbackRequest(formData: FormData): Promise<void> {
  await requireAuth();
  const requestId = String(formData.get("id") ?? "").trim();
  if (!requestId) return;

  const sb = supabaseServer();

  const { data: req } = await sb
    .from("feedback_requests")
    .select("id, status, conversation_id")
    .eq("id", requestId)
    .single();
  if (!req) return;

  if (req.status === "completed" || req.status === "expired") return;

  await sb
    .from("feedback_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  if (req.conversation_id) {
    await sb
      .from("conversations")
      .update({ status: "closed" })
      .eq("id", req.conversation_id);
  }

  revalidatePath("/feedback");
  revalidatePath("/services");
}
