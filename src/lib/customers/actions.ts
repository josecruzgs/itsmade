"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/actions";
import type { ServiceJobStatus } from "@/lib/supabase/types";

// -----------------------------------------------------------------------------
// Update customer info
// -----------------------------------------------------------------------------

const customerSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  company_name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  whatsapp_phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(
      (v) => v.length >= 10 && v.length <= 15,
      "WhatsApp inválido (10-15 dígitos)",
    ),
  email: z
    .union([z.string().trim().email("Email inválido"), z.literal("")])
    .optional()
    .transform((v) => v || null),
});

export async function updateCustomer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "id requerido" };

  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    company_name: formData.get("company_name") ?? "",
    whatsapp_phone: formData.get("whatsapp_phone") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const sb = supabaseServer();
  const { error } = await sb
    .from("customers")
    .update({
      name: parsed.data.name,
      company_name: parsed.data.company_name,
      whatsapp_phone: parsed.data.whatsapp_phone,
      email: parsed.data.email,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "Ya existe otro cliente con ese WhatsApp. Usa un número distinto o edita el cliente existente.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/clients");
  return { ok: true, message: "Cliente actualizado." };
}

// -----------------------------------------------------------------------------
// Get paginated services for a customer (5 per page).
// -----------------------------------------------------------------------------

export interface CustomerServiceMini {
  id: string;
  scheduled_at: string | null;
  completed_at: string | null;
  status: ServiceJobStatus;
  cost_mxn: number | null;
  created_at: string;
  branch: { name: string; city: string } | null;
  service: { name: string; code: string } | null;
  feedback_requests: Array<{ status: string }>;
}

export interface CustomerServicesPage {
  services: CustomerServiceMini[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Busqueda rapida de clientes (top 10) para el picker del modal de nuevo
 * servicio. Hace ilike en nombre, empresa, whatsapp y email.
 */
export interface CustomerSearchResult {
  id: string;
  name: string | null;
  company_name: string | null;
  whatsapp_phone: string;
  email: string | null;
}

export async function searchCustomers(
  query: string,
): Promise<CustomerSearchResult[]> {
  await requireAuth();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const sb = supabaseServer();
  const escaped = trimmed.replace(/[%_]/g, (m) => `\\${m}`);
  const pattern = `%${escaped}%`;

  const { data, error } = await sb
    .from("customers")
    .select("id, name, company_name, whatsapp_phone, email")
    .or(
      [
        `name.ilike.${pattern}`,
        `company_name.ilike.${pattern}`,
        `whatsapp_phone.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ].join(","),
    )
    .order("name", { ascending: true, nullsFirst: false })
    .limit(10);

  if (error) return [];
  return (data ?? []) as CustomerSearchResult[];
}

export async function getCustomerServices(
  customerId: string,
  page: number = 1,
): Promise<CustomerServicesPage> {
  await requireAuth();
  const pageSize = 5;
  const safePage = Math.max(1, Math.floor(page) || 1);
  const offset = (safePage - 1) * pageSize;
  const sb = supabaseServer();

  const { data, count, error } = await sb
    .from("service_jobs")
    .select(
      `
      id, scheduled_at, completed_at, status, cost_mxn, created_at,
      branch:branches!service_jobs_branch_id_fkey(name, city),
      service:services!service_jobs_service_id_fkey(name, code),
      feedback_requests(status)
    `,
      { count: "exact" },
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    services: (data ?? []) as unknown as CustomerServiceMini[],
    totalCount: count ?? 0,
    page: safePage,
    pageSize,
  };
}
