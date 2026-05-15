import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "@/lib/agents/_shared/anthropic";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import { RECOMMENDATIONS_SYSTEM_PROMPT } from "@/lib/agents/recommendations/prompt";

const log = createLogger("recommendations-agent");

interface GenerateInput {
  /** id del profile que dispara el reporte (queda en generated_by_profile_id). */
  profileId: string;
}

export type GenerateResult =
  | { ok: true; reportId: string; feedbackCount: number }
  | { ok: false; reason: "no_pending" }
  | { ok: false; reason: "anthropic_failed"; message: string }
  | { ok: false; reason: "db_failed"; message: string };

interface FeedbackPayloadRow {
  id: string;
  score_overall_avg: number | null;
  completed_at: string | null;
  summary: string | null;
  customer: { name: string | null } | null;
  service: { name: string } | null;
  branch: { city: string; name: string } | null;
  feedback_answers: Array<{
    question_index: number;
    raw_answer: string;
    normalized_score: number | null;
    normalized_text: string | null;
  }>;
}

const QUESTION_LABELS: Record<number, string> = {
  1: "General",
  2: "Puntualidad",
  3: "Calidad",
  4: "Trato",
  5: "Comentario",
};

/**
 * Lee todo el feedback completado y no analizado, lo manda a Claude en un solo
 * turno, persiste el reporte y marca los feedback como analizados.
 *
 * Sin tool use, sin loop, sin state — es batch one-shot.
 */
export async function generateImprovementReport(
  input: GenerateInput,
): Promise<GenerateResult> {
  const sb = supabaseServer();

  // 1. Cargar feedback completado y no analizado.
  const { data, error } = await sb
    .from("feedback_requests")
    .select(
      `
      id, score_overall_avg, completed_at, summary,
      customer:customers!feedback_requests_customer_id_fkey(name),
      service:services!feedback_requests_service_id_fkey(name),
      branch:branches!feedback_requests_branch_id_fkey(name, city),
      feedback_answers(question_index, raw_answer, normalized_score, normalized_text)
    `,
    )
    .eq("status", "completed")
    .is("analyzed_in_report_id", null)
    .order("completed_at", { ascending: false });

  if (error) {
    log.error("query_feedback_failed", { error: error.message });
    return { ok: false, reason: "db_failed", message: error.message };
  }

  const rows = (data ?? []) as unknown as FeedbackPayloadRow[];
  if (rows.length === 0) {
    return { ok: false, reason: "no_pending" };
  }

  // 2. Construir payload denso para el modelo.
  const payload = buildPayload(rows);

  log.info("agent_call_start", {
    profile_id: input.profileId,
    feedback_count: rows.length,
    model: MODELS.recommendations(),
  });

  let reportMarkdown: string;
  try {
    const response = await anthropic().messages.create({
      model: MODELS.recommendations(),
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: RECOMMENDATIONS_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: payload }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) {
      log.error("empty_response", { stop_reason: response.stop_reason });
      return {
        ok: false,
        reason: "anthropic_failed",
        message: "Respuesta vacia del modelo.",
      };
    }
    reportMarkdown = text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("anthropic_call_failed", { error: message });
    return { ok: false, reason: "anthropic_failed", message };
  }

  // 3. Insertar reporte.
  const { data: report, error: insertErr } = await sb
    .from("improvement_reports")
    .insert({
      generated_by_profile_id: input.profileId,
      feedback_count: rows.length,
      report_markdown: reportMarkdown,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !report) {
    log.error("insert_report_failed", { error: insertErr?.message });
    return {
      ok: false,
      reason: "db_failed",
      message: insertErr?.message ?? "No se pudo insertar el reporte.",
    };
  }

  // 4. Marcar feedback como analizados (apuntando al nuevo reporte).
  const ids = rows.map((r) => r.id);
  const { error: updateErr } = await sb
    .from("feedback_requests")
    .update({ analyzed_in_report_id: report.id })
    .in("id", ids);

  if (updateErr) {
    // Rollback manual: el reporte ya quedo insertado, pero ningun feedback
    // apunta a el. Borramos el reporte para que el admin pueda reintentar
    // sin quedarse con un reporte huerfano.
    log.error("update_feedback_failed_rolling_back", {
      error: updateErr.message,
      report_id: report.id,
    });
    await sb.from("improvement_reports").delete().eq("id", report.id);
    return { ok: false, reason: "db_failed", message: updateErr.message };
  }

  log.info("agent_call_ok", {
    report_id: report.id,
    feedback_count: rows.length,
  });

  return { ok: true, reportId: report.id, feedbackCount: rows.length };
}

function buildPayload(rows: FeedbackPayloadRow[]): string {
  const intro = `Batch de ${rows.length} feedback completados a analizar. Genera el reporte siguiendo la estructura del system prompt.`;

  const blocks = rows.map((r, idx) => {
    const ratings = r.feedback_answers
      .filter((a) => a.question_index >= 1 && a.question_index <= 4)
      .sort((a, b) => a.question_index - b.question_index)
      .map(
        (a) =>
          `${QUESTION_LABELS[a.question_index]}=${
            a.normalized_score ?? "n/a"
          }/5`,
      )
      .join(", ");

    const comment = r.feedback_answers.find((a) => a.question_index === 5);
    const commentText = comment
      ? `"${(comment.normalized_text || comment.raw_answer).slice(0, 500)}"`
      : "[sin comentario]";

    return [
      `--- Feedback ${idx + 1} ---`,
      `Cliente: ${r.customer?.name ?? "[anonimo]"}`,
      `Servicio: ${r.service?.name ?? "[n/d]"} · Sucursal: ${r.branch?.city ?? "[n/d]"} (${r.branch?.name ?? "[n/d]"})`,
      `Scores: ${ratings || "[sin ratings]"} · Promedio: ${r.score_overall_avg?.toFixed(1) ?? "n/a"}/5`,
      `Comentario libre: ${commentText}`,
      r.summary ? `Resumen previo: ${r.summary}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [intro, "", ...blocks, "", "Genera el reporte ahora."].join("\n");
}
