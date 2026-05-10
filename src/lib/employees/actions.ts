"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/actions";

const employeeSchema = z.object({
  full_name: z.string().trim().min(1, "Nombre requerido").max(120),
  position: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  area: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  whatsapp_phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(
      (v) => v.length >= 10 && v.length <= 15,
      "WhatsApp invalido (10-15 digitos)",
    ),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

function parseEmployeeForm(formData: FormData) {
  return employeeSchema.safeParse({
    full_name: formData.get("full_name"),
    position: formData.get("position") ?? "",
    area: formData.get("area") ?? "",
    whatsapp_phone: formData.get("whatsapp_phone") ?? "",
    notes: formData.get("notes") ?? "",
    active: formData.get("active") ?? "on",
  });
}

export async function createEmployee(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const sb = supabaseServer();
  const { error } = await sb.from("employees").insert(parsed.data);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un empleado con ese WhatsApp." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/employees");
  return { ok: true, message: "Empleado registrado." };
}

export async function updateEmployee(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "id requerido" };

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const sb = supabaseServer();
  const { error } = await sb.from("employees").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Otro empleado ya tiene ese WhatsApp. Cambialo en uno de los dos.",
      };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/employees");
  return { ok: true, message: "Empleado actualizado." };
}

export async function deleteEmployee(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const sb = supabaseServer();
  // ON DELETE SET NULL en service_jobs.assigned_employee_id, asi que esto
  // no rompe servicios ya asignados — solo los desvincula.
  await sb.from("employees").delete().eq("id", id);
  revalidatePath("/employees");
}
