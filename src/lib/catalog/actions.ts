"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/actions";

// -----------------------------------------------------------------------------
// Categorías — solo edicion de nombre/descripcion (los slugs estan fijos por
// CHECK constraint a 'residencial' | 'comercial' | 'industrial').
// -----------------------------------------------------------------------------

const categoryUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function updateCategory(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const sb = supabaseServer();
  const { error } = await sb
    .from("service_categories")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/catalog");
  return { ok: true, message: "Categoría actualizada." };
}

// -----------------------------------------------------------------------------
// Servicios
// -----------------------------------------------------------------------------

const serviceSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Solo mayúsculas, números y guiones"),
  name: z.string().trim().min(1).max(150),
  category_id: z.string().uuid("Selecciona una categoría"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  base_price_mxn: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (typeof v === "number" && v >= 0 && v < 1_000_000), {
      message: "Precio inválido",
    }),
});

function parseServiceForm(formData: FormData) {
  return serviceSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    description: formData.get("description") ?? "",
    base_price_mxn: formData.get("base_price_mxn") ?? "",
  });
}

export async function createService(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const sb = supabaseServer();
  const { error } = await sb.from("services").insert({
    code: parsed.data.code,
    name: parsed.data.name,
    category_id: parsed.data.category_id,
    description: parsed.data.description || null,
    base_price_mxn: parsed.data.base_price_mxn,
    active: true,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un servicio con ese código." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/catalog");
  return { ok: true, message: "Servicio creado." };
}

export async function updateService(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "id requerido" };
  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const sb = supabaseServer();
  const { error } = await sb
    .from("services")
    .update({
      code: parsed.data.code,
      name: parsed.data.name,
      category_id: parsed.data.category_id,
      description: parsed.data.description || null,
      base_price_mxn: parsed.data.base_price_mxn,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe otro servicio con ese código." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/catalog");
  return { ok: true, message: "Servicio actualizado." };
}

export async function toggleServiceActive(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  const sb = supabaseServer();
  await sb.from("services").update({ active: !active }).eq("id", id);
  revalidatePath("/catalog");
}

export async function deleteService(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = supabaseServer();
  await sb.from("services").delete().eq("id", id);
  revalidatePath("/catalog");
}
