"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { evolutionClient } from "@/lib/evolution/client";
import { buildServicePdfForJob } from "@/lib/pdf/build-for-job";
import { uploadServicePdf } from "@/lib/storage/service-pdfs";
import { createLogger } from "@/lib/logger";
import type { ActionResult } from "@/lib/auth/actions";

const log = createLogger("send-service-pdf");

/**
 * Genera la hoja PDF del servicio, la sube a Supabase Storage y la envia al
 * empleado seleccionado por WhatsApp via Evolution. Asigna assigned_employee_id
 * y registra pdf_sent_at en service_jobs.
 *
 * Si el envio por WhatsApp falla, igual queda el PDF en Storage y NO se asigna
 * al empleado (asi el admin puede reintentar).
 */
export async function sendServicePdfToEmployee(args: {
  serviceJobId: string;
  employeeId: string;
}): Promise<ActionResult> {
  await requireAuth();
  const { serviceJobId, employeeId } = args;
  if (!serviceJobId || !employeeId) {
    return { ok: false, error: "Faltan parametros." };
  }

  const sb = supabaseServer();

  // 1. Cargar el empleado destino.
  const { data: employee, error: empErr } = await sb
    .from("employees")
    .select("id, full_name, whatsapp_phone, active")
    .eq("id", employeeId)
    .single();
  if (empErr || !employee) {
    return { ok: false, error: "Empleado no encontrado." };
  }
  if (!employee.active) {
    return { ok: false, error: "Ese empleado esta marcado como inactivo." };
  }

  // 2. Generar PDF + cargar datos del servicio para el caption.
  let pdfBytes: Uint8Array;
  let fileName: string;
  let customerName: string | null;
  try {
    const built = await buildServicePdfForJob(serviceJobId);
    pdfBytes = built.pdfBytes;
    fileName = built.fileName;
    customerName = built.customerName;
  } catch (err) {
    log.error("pdf_build_failed", { error: (err as Error).message, serviceJobId });
    return { ok: false, error: `No se pudo generar el PDF: ${(err as Error).message}` };
  }

  // Datos del servicio para el caption (un select corto, no joineado).
  const { data: jobMeta } = await sb
    .from("service_jobs")
    .select(
      `scheduled_at, address, service:services!service_jobs_service_id_fkey(name)`,
    )
    .eq("id", serviceJobId)
    .single<{
      scheduled_at: string | null;
      address: string | null;
      service: { name: string } | null;
    }>();

  // 3. Subir a Storage y obtener signed URL.
  let signedUrl: string;
  try {
    const uploaded = await uploadServicePdf({ serviceJobId, pdfBytes });
    signedUrl = uploaded.signedUrl;
  } catch (err) {
    log.error("pdf_upload_failed", { error: (err as Error).message, serviceJobId });
    return { ok: false, error: `No se pudo subir el PDF: ${(err as Error).message}` };
  }

  // 4. Enviar por WhatsApp al empleado.
  const caption = buildCaption({
    employeeName: employee.full_name,
    customerName,
    serviceName: jobMeta?.service?.name ?? "servicio",
    scheduledAt: jobMeta?.scheduled_at ?? null,
    address: jobMeta?.address ?? null,
  });

  try {
    const evo = evolutionClient();
    await evo.sendMedia({
      number: `${employee.whatsapp_phone}@s.whatsapp.net`,
      mediaUrl: signedUrl,
      fileName,
      mimetype: "application/pdf",
      mediatype: "document",
      caption,
    });
  } catch (err) {
    log.error("send_media_failed", { error: (err as Error).message, serviceJobId });
    return {
      ok: false,
      error: `El PDF se genero pero Evolution no pudo enviarlo: ${(err as Error).message}`,
    };
  }

  // 5. Actualizar service_jobs con asignacion + timestamp.
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await sb
    .from("service_jobs")
    .update({
      assigned_employee_id: employee.id,
      pdf_sent_at: nowIso,
    })
    .eq("id", serviceJobId);
  if (updateErr) {
    return {
      ok: false,
      error: `PDF enviado a ${employee.full_name}, pero no se pudo guardar la asignacion: ${updateErr.message}`,
    };
  }

  revalidatePath("/services");
  return {
    ok: true,
    message: `Hoja enviada a ${employee.full_name} por WhatsApp.`,
  };
}

function buildCaption(opts: {
  employeeName: string;
  customerName: string | null | undefined;
  serviceName: string;
  scheduledAt: string | null;
  address: string | null;
}): string {
  const firstName = opts.employeeName.trim().split(/\s+/)[0];
  const customer = opts.customerName ? ` para ${opts.customerName}` : "";
  const fecha = opts.scheduledAt
    ? new Date(opts.scheduledAt).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const partes: string[] = [
    `Hola ${firstName}, te asignamos un servicio${customer}.`,
    `Servicio: ${opts.serviceName}`,
  ];
  if (fecha) partes.push(`Fecha: ${fecha}`);
  if (opts.address) partes.push(`Direccion: ${opts.address}`);
  partes.push("Adjunto la hoja con el detalle completo. Cualquier duda avisame.");
  return partes.join("\n");
}
