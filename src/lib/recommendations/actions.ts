"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { generateImprovementReport } from "@/lib/agents/recommendations/agent";
import { createLogger } from "@/lib/logger";
import type { ActionResult } from "@/lib/auth/actions";

const log = createLogger("recommendations-actions");

/**
 * Dispara el agente de recomendaciones: analiza todos los feedback completados
 * que aun no fueron analizados, genera un reporte y los marca como analizados.
 */
export async function runRecommendationsAgent(): Promise<ActionResult> {
  const me = await requireAdmin();

  const result = await generateImprovementReport({ profileId: me.id });

  if (result.ok) {
    revalidatePath("/recommendations");
    revalidatePath("/feedback");
    return {
      ok: true,
      message: `Reporte generado a partir de ${result.feedbackCount} ${result.feedbackCount === 1 ? "feedback" : "feedbacks"}.`,
    };
  }

  if (result.reason === "no_pending") {
    return {
      ok: false,
      error: "No hay feedback sin analizar. Espera nuevas respuestas de clientes.",
    };
  }

  log.error("generation_failed", { reason: result.reason, message: result.message });
  return {
    ok: false,
    error:
      result.reason === "anthropic_failed"
        ? `Falla del modelo: ${result.message}`
        : `Error de base de datos: ${result.message}`,
  };
}

/**
 * Marca un reporte como aplicado. Admin puede agregar notas opcionales
 * describiendo que cambios se hicieron.
 */
export async function markReportApplied(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const reportId = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!reportId) return;

  const sb = supabaseServer();
  await sb
    .from("improvement_reports")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_by_profile_id: me.id,
      applied_notes: notes,
    })
    .eq("id", reportId);

  revalidatePath("/recommendations");
}

/**
 * Revierte un reporte a 'pending'. Util si se marco aplicado por error.
 */
export async function markReportPending(formData: FormData): Promise<void> {
  await requireAdmin();
  const reportId = String(formData.get("id") ?? "").trim();
  if (!reportId) return;

  const sb = supabaseServer();
  await sb
    .from("improvement_reports")
    .update({
      status: "pending",
      applied_at: null,
      applied_by_profile_id: null,
      applied_notes: null,
    })
    .eq("id", reportId);

  revalidatePath("/recommendations");
}
