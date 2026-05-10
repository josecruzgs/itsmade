"use server";

import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { evolutionClient } from "@/lib/evolution/client";
import { buildServiceSheetPdf } from "@/lib/pdf/service-sheet";
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

  // 1. Cargar el service_job con joins necesarios para el PDF.
  const { data: job, error: jobErr } = await sb
    .from("service_jobs")
    .select(
      `
      id, scheduled_at, completed_at, status, notes, address, cost_mxn, created_at,
      customer:customers!service_jobs_customer_id_fkey(name, company_name, whatsapp_phone, email),
      branch:branches!service_jobs_branch_id_fkey(name, city, state),
      service:services!service_jobs_service_id_fkey(name, code, category_id)
      `,
    )
    .eq("id", serviceJobId)
    .single<{
      id: string;
      scheduled_at: string | null;
      completed_at: string | null;
      status: string;
      notes: string | null;
      address: string | null;
      cost_mxn: number | null;
      created_at: string;
      customer: { name: string | null; company_name: string | null; whatsapp_phone: string; email: string | null } | null;
      branch: { name: string; city: string; state: string | null } | null;
      service: { name: string; code: string; category_id: string } | null;
    }>();

  if (jobErr || !job) {
    return { ok: false, error: jobErr?.message ?? "Servicio no encontrado." };
  }

  // 2. Cargar el nombre de la categoria del servicio (un join mas).
  let categoryName: string | null = null;
  if (job.service?.category_id) {
    const { data: cat } = await sb
      .from("service_categories")
      .select("name")
      .eq("id", job.service.category_id)
      .single();
    categoryName = cat?.name ?? null;
  }

  // 3. Cargar el empleado destino.
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

  const e = env();

  // 4. Generar el PDF.
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildServiceSheetPdf({
      job: {
        id: job.id,
        scheduled_at: job.scheduled_at,
        completed_at: job.completed_at,
        status: job.status,
        notes: job.notes,
        address: job.address,
        cost_mxn: job.cost_mxn,
        created_at: job.created_at,
      },
      customer: job.customer,
      branch: job.branch,
      service: job.service
        ? {
            name: job.service.name,
            code: job.service.code,
            category_name: categoryName,
          }
        : null,
      brand: {
        name: e.ITSMADE_BRAND_NAME,
        website: e.ITSMADE_WEBSITE,
      },
    });
  } catch (err) {
    log.error("pdf_build_failed", { error: (err as Error).message, serviceJobId });
    return { ok: false, error: `No se pudo generar el PDF: ${(err as Error).message}` };
  }

  // 5. Subir a Storage y obtener signed URL.
  let signedUrl: string;
  try {
    const uploaded = await uploadServicePdf({ serviceJobId, pdfBytes });
    signedUrl = uploaded.signedUrl;
  } catch (err) {
    log.error("pdf_upload_failed", { error: (err as Error).message, serviceJobId });
    return { ok: false, error: `No se pudo subir el PDF: ${(err as Error).message}` };
  }

  // 6. Enviar por WhatsApp al empleado.
  const fileName = `hoja-servicio-${job.id.slice(0, 8)}.pdf`;
  const caption = buildCaption({
    employeeName: employee.full_name,
    customerName: job.customer?.name,
    serviceName: job.service?.name ?? "servicio",
    scheduledAt: job.scheduled_at,
    address: job.address,
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

  // 7. Actualizar service_jobs con asignacion + timestamp.
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await sb
    .from("service_jobs")
    .update({
      assigned_employee_id: employee.id,
      pdf_sent_at: nowIso,
    })
    .eq("id", serviceJobId);
  if (updateErr) {
    // El envio si pego pero no pudimos guardar la asignacion. Avisamos en error.
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
