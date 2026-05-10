"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import type { IntakeRequestStatus } from "@/lib/supabase/types";

/**
 * Marca un intake como atendido (status='converted' o 'dismissed') y opcionalmente
 * lo enlaza a un service_jobs creado manualmente.
 */
export async function updateIntakeStatus(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim() as IntakeRequestStatus;
  const serviceJobId = String(formData.get("service_job_id") ?? "").trim();
  if (!id) return;
  if (!["pending_review", "in_review", "converted", "dismissed"].includes(nextStatus)) {
    return;
  }

  const sb = supabaseServer();
  await sb
    .from("service_intake_requests")
    .update({
      status: nextStatus,
      ...(serviceJobId ? { service_job_id: serviceJobId } : {}),
    })
    .eq("id", id);

  revalidatePath("/intake");
}

/**
 * Asigna el intake al usuario actual (toma ownership del lead).
 * Cambia status a 'in_review' y registra assigned_to_profile_id.
 */
export async function assignIntakeToMe(formData: FormData): Promise<void> {
  const me = await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const sb = supabaseServer();
  await sb
    .from("service_intake_requests")
    .update({
      status: "in_review",
      assigned_to_profile_id: me.id,
    })
    .eq("id", id);

  revalidatePath("/intake");
}

/**
 * Edita las notas internas de un intake (anotaciones del asesor humano).
 */
export async function updateIntakeNotes(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return;

  const sb = supabaseServer();
  await sb
    .from("service_intake_requests")
    .update({ notes: notes || null })
    .eq("id", id);

  revalidatePath("/intake");
}
