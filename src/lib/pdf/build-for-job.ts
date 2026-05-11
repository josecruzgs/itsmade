import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { buildServiceSheetPdf } from "@/lib/pdf/service-sheet";

export interface BuildServicePdfResult {
  pdfBytes: Uint8Array;
  fileName: string;
  customerName: string | null;
}

/**
 * Carga el service_job por id (con joins de cliente, sucursal, servicio,
 * categoria) y genera la hoja PDF. Reusable desde el server action de envio
 * por WhatsApp y desde la API route de descarga.
 *
 * Lanza error si el servicio no existe.
 */
export async function buildServicePdfForJob(
  serviceJobId: string,
): Promise<BuildServicePdfResult> {
  const sb = supabaseServer();

  const { data: job, error: jobErr } = await sb
    .from("service_jobs")
    .select(
      `
      id, scheduled_at, completed_at, status, notes, address, cost_mxn, created_at,
      customer:customers!service_jobs_customer_id_fkey(name, company_name, whatsapp_phone, email),
      branch:branches!service_jobs_branch_id_fkey(name, city, state),
      service:services!service_jobs_service_id_fkey(name, code, category_id),
      assigned_employee:employees!service_jobs_assigned_employee_id_fkey(full_name, position, area, whatsapp_phone)
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
      assigned_employee: { full_name: string; position: string | null; area: string | null; whatsapp_phone: string } | null;
    }>();

  if (jobErr || !job) {
    throw new Error(jobErr?.message ?? "Servicio no encontrado.");
  }

  let categoryName: string | null = null;
  if (job.service?.category_id) {
    const { data: cat } = await sb
      .from("service_categories")
      .select("name")
      .eq("id", job.service.category_id)
      .single();
    categoryName = cat?.name ?? null;
  }

  const e = env();
  const pdfBytes = await buildServiceSheetPdf({
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
    employee: job.assigned_employee,
    brand: {
      name: e.ITSMADE_BRAND_NAME,
      website: e.ITSMADE_WEBSITE,
      supportPhone: e.ITSMADE_SUPPORT_PHONE,
    },
  });

  return {
    pdfBytes,
    fileName: `hoja-servicio-${job.id.slice(0, 8)}.pdf`,
    customerName: job.customer?.name ?? null,
  };
}
