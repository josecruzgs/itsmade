"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/actions";

const branchSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(120),
  city: z.string().trim().min(1, "La ciudad es requerida").max(80),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

function parseBranchForm(formData: FormData) {
  return branchSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    state: formData.get("state") ?? "",
    phone: formData.get("phone") ?? "",
  });
}

export async function createBranch(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseBranchForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const sb = supabaseServer();
  const { error } = await sb.from("branches").insert({
    name: parsed.data.name,
    city: parsed.data.city,
    state: parsed.data.state || null,
    phone: parsed.data.phone || null,
    active: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/branches");
  return { ok: true, message: "Sucursal creada." };
}

export async function updateBranch(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "id requerido" };
  const parsed = parseBranchForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const sb = supabaseServer();
  const { error } = await sb
    .from("branches")
    .update({
      name: parsed.data.name,
      city: parsed.data.city,
      state: parsed.data.state || null,
      phone: parsed.data.phone || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/branches");
  return { ok: true, message: "Sucursal actualizada." };
}

export async function toggleBranchActive(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  const sb = supabaseServer();
  await sb.from("branches").update({ active: !active }).eq("id", id);
  revalidatePath("/branches");
}

export async function deleteBranch(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = supabaseServer();
  // El FK en service_jobs.branch_id es ON DELETE RESTRICT — fallara si hay jobs.
  // En ese caso, mejor desactivar la sucursal en lugar de borrarla.
  await sb.from("branches").delete().eq("id", id);
  revalidatePath("/branches");
}
