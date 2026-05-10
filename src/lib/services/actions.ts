"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/actions";
import type { ServiceJobStatus } from "@/lib/supabase/types";

const STATUS_VALUES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

const formSchema = z.object({
  customer_name: z.string().trim().min(1, "Nombre requerido").max(120),
  customer_company: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  customer_whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(
      (v) => v.length >= 10 && v.length <= 15,
      "WhatsApp inválido (10-15 dígitos)",
    ),
  customer_email: z
    .union([z.string().trim().email("Email inválido"), z.literal("")])
    .optional()
    .transform((v) => v || null),
  branch_id: z.string().uuid("Sucursal requerida"),
  service_id: z.string().uuid("Servicio requerido"),
  address: z
    .string()
    .trim()
    .max(250)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  cost_mxn: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (typeof v === "number" && !isNaN(v) && v >= 0 && v < 10_000_000),
      "Costo inválido",
    ),
  scheduled_at: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? new Date(v).toISOString() : null)),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  status: z.enum(STATUS_VALUES).default("scheduled"),
});

function parseForm(formData: FormData) {
  return formSchema.safeParse({
    customer_name: formData.get("customer_name"),
    customer_company: formData.get("customer_company") ?? "",
    customer_whatsapp: formData.get("customer_whatsapp") ?? "",
    customer_email: formData.get("customer_email") ?? "",
    branch_id: formData.get("branch_id"),
    service_id: formData.get("service_id"),
    address: formData.get("address") ?? "",
    cost_mxn: formData.get("cost_mxn") ?? "",
    scheduled_at: formData.get("scheduled_at") ?? "",
    notes: formData.get("notes") ?? "",
    status: formData.get("status") ?? "scheduled",
  });
}

export async function createServiceJob(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const data = parsed.data;
  const sb = supabaseServer();

  // Upsert cliente por whatsapp_phone (si ya existe, actualiza datos).
  const { data: customer, error: customerErr } = await sb
    .from("customers")
    .upsert(
      {
        whatsapp_phone: data.customer_whatsapp,
        name: data.customer_name,
        email: data.customer_email,
        company_name: data.customer_company,
      },
      { onConflict: "whatsapp_phone" },
    )
    .select("id")
    .single();

  if (customerErr || !customer) {
    return {
      ok: false,
      error: customerErr?.message ?? "No se pudo guardar el cliente",
    };
  }

  // Insert service_job. Si status='completed', set completed_at automaticamente.
  const completed_at =
    data.status === "completed" ? new Date().toISOString() : null;

  const { data: created, error: jobErr } = await sb
    .from("service_jobs")
    .insert({
      customer_id: customer.id,
      branch_id: data.branch_id,
      service_id: data.service_id,
      address: data.address,
      cost_mxn: data.cost_mxn,
      notes: data.notes,
      scheduled_at: data.scheduled_at,
      status: data.status,
      completed_at,
    })
    .select("id")
    .single();

  if (jobErr || !created) {
    return { ok: false, error: jobErr?.message ?? "No se pudo crear el servicio" };
  }

  // Si el form viene desde el flujo de /intake (boton "Convertir a servicio"),
  // marca el intake como 'converted' y enlazalo al service_job recien creado.
  const intakeId = String(formData.get("intake_id") ?? "").trim();
  if (intakeId) {
    await sb
      .from("service_intake_requests")
      .update({ status: "converted", service_job_id: created.id })
      .eq("id", intakeId);
    revalidatePath("/intake");
  }

  revalidatePath("/services");
  return { ok: true, message: "Servicio registrado." };
}

export async function updateServiceJob(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "id requerido" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const data = parsed.data;
  const sb = supabaseServer();

  const { data: existing } = await sb
    .from("service_jobs")
    .select("customer_id, status, completed_at")
    .eq("id", id)
    .single();
  if (!existing) return { ok: false, error: "Servicio no encontrado" };

  // Actualizar datos del cliente. Si la nueva whatsapp colisiona con otro
  // cliente existente, retornamos error amable.
  const { error: customerErr } = await sb
    .from("customers")
    .update({
      whatsapp_phone: data.customer_whatsapp,
      name: data.customer_name,
      email: data.customer_email,
      company_name: data.customer_company,
    })
    .eq("id", existing.customer_id);

  if (customerErr) {
    if (customerErr.code === "23505") {
      return {
        ok: false,
        error:
          "Ya existe otro cliente con ese WhatsApp. Edita ese cliente o usa un número distinto.",
      };
    }
    return { ok: false, error: customerErr.message };
  }

  // Si cambia el status hacia/desde 'completed', ajustamos completed_at.
  let completed_at: string | null = existing.completed_at;
  if (data.status === "completed" && !existing.completed_at) {
    completed_at = new Date().toISOString();
  } else if (data.status !== "completed") {
    completed_at = null;
  }

  const { error: jobErr } = await sb
    .from("service_jobs")
    .update({
      branch_id: data.branch_id,
      service_id: data.service_id,
      address: data.address,
      cost_mxn: data.cost_mxn,
      notes: data.notes,
      scheduled_at: data.scheduled_at,
      status: data.status,
      completed_at,
    })
    .eq("id", id);

  if (jobErr) return { ok: false, error: jobErr.message };

  revalidatePath("/services");
  return { ok: true, message: "Servicio actualizado." };
}

/**
 * Cambia el status del servicio (botones inline en cada fila).
 * Si pasa a 'completed' marca completed_at = now(); si sale de 'completed'
 * lo limpia.
 */
export async function changeServiceJobStatus(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const newStatus = String(formData.get("status") ?? "");
  if (!id || !STATUS_VALUES.includes(newStatus as (typeof STATUS_VALUES)[number])) {
    return;
  }

  const sb = supabaseServer();
  const update: { status: ServiceJobStatus; completed_at?: string | null } = {
    status: newStatus as ServiceJobStatus,
  };
  if (newStatus === "completed") {
    update.completed_at = new Date().toISOString();
  } else {
    update.completed_at = null;
  }

  await sb.from("service_jobs").update(update).eq("id", id);
  revalidatePath("/services");
}

export async function deleteServiceJob(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = supabaseServer();
  // CASCADE eliminara feedback_requests asociadas via la FK ON DELETE CASCADE.
  await sb.from("service_jobs").delete().eq("id", id);
  revalidatePath("/services");
}

/**
 * Elimina un servicio exigiendo la contrasena del usuario logeado.
 *
 * Verifica la contrasena via fetch directo al endpoint de auth de Supabase
 * para no tocar las cookies de sesion (a diferencia de signInWithPassword
 * via supabase-js que setea nuevas cookies). Si es correcta, procede al
 * delete con service-role.
 */
export async function deleteServiceJobWithPassword(args: {
  id: string;
  password: string;
}): Promise<ActionResult> {
  const me = await requireAuth();
  if (!args.id) return { ok: false, error: "id requerido" };
  if (!args.password) {
    return { ok: false, error: "Ingresa tu contraseña para confirmar." };
  }
  if (!me.email) {
    return {
      ok: false,
      error: "Tu sesión no tiene email asociado. Cierra sesión y vuelve a entrar.",
    };
  }

  const e = env();
  const verifyRes = await fetch(
    `${e.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: me.email, password: args.password }),
      cache: "no-store",
    },
  );

  if (!verifyRes.ok) {
    if (verifyRes.status === 400 || verifyRes.status === 401) {
      return { ok: false, error: "Contraseña incorrecta." };
    }
    return {
      ok: false,
      error: `No se pudo verificar la contraseña (HTTP ${verifyRes.status}).`,
    };
  }

  const sb = supabaseServer();
  const { error: deleteErr } = await sb
    .from("service_jobs")
    .delete()
    .eq("id", args.id);
  if (deleteErr) {
    return { ok: false, error: deleteErr.message };
  }

  revalidatePath("/services");
  return { ok: true, message: "Servicio eliminado." };
}
