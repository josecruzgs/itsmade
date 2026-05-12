import { AdminShell } from "@/components/AdminShell";
import {
  FeedbackTable,
} from "@/components/FeedbackTable";
import type { FeedbackDetailRow } from "@/components/FeedbackDetailModal";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("feedback_requests")
    .select(
      `
      id, status, score_overall_avg, nps_bucket,
      sent_at, completed_at, expired_at, created_at,
      summary, summary_generated_at,
      customer:customers!feedback_requests_customer_id_fkey(id, name, whatsapp_phone),
      branch:branches!feedback_requests_branch_id_fkey(id, name, city),
      service:services!feedback_requests_service_id_fkey(id, name, code),
      feedback_answers(id, request_id, question_index, raw_answer, normalized_score, normalized_text, answered_at)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <AdminShell title="Feedback">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {error.message}
        </div>
      </AdminShell>
    );
  }

  const rows = (data ?? []) as unknown as FeedbackDetailRow[];

  const scoredRows = rows.filter(
    (r): r is FeedbackDetailRow & { score_overall_avg: number } =>
      typeof r.score_overall_avg === "number",
  );
  const avgScore =
    scoredRows.length > 0
      ? Math.round(
          (scoredRows.reduce((sum, r) => sum + r.score_overall_avg, 0) /
            scoredRows.length) *
            10,
        ) / 10
      : null;

  const summary = {
    total: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    promoter: rows.filter((r) => r.nps_bucket === "promoter").length,
    passive: rows.filter((r) => r.nps_bucket === "passive").length,
    detractor: rows.filter((r) => r.nps_bucket === "detractor").length,
    pending: rows.filter((r) =>
      ["pending", "in_progress"].includes(r.status),
    ).length,
    expired: rows.filter((r) => r.status === "expired").length,
    avgScore,
    scoredCount: scoredRows.length,
  };

  return (
    <AdminShell
      title="Feedback"
      description={`${summary.total} solicitudes totales · ${summary.completed} completadas.`}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <ScoreCard
          avgScore={summary.avgScore}
          count={summary.scoredCount}
        />
        <SummaryCard label="Promotores" value={summary.promoter} tone="success" />
        <SummaryCard label="Pasivos" value={summary.passive} tone="warning" />
        <SummaryCard label="Detractores" value={summary.detractor} tone="danger" />
        <SummaryCard label="Pendientes" value={summary.pending} tone="neutral" />
        <SummaryCard label="Expirados" value={summary.expired} tone="neutral" />
      </div>

      <FeedbackTable rows={rows} />
    </AdminShell>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneCls: Record<typeof tone, string> = {
    success: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    danger: "text-red-700 dark:text-red-300",
    neutral: "text-slate-700 dark:text-slate-300",
  };
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls[tone]}`}
      >
        {value}
      </div>
    </div>
  );
}

function ScoreCard({
  avgScore,
  count,
}: {
  avgScore: number | null;
  count: number;
}) {
  // Tono según el promedio (mismos cortes que NPS bucket en agent.ts)
  const tone =
    avgScore === null
      ? "neutral"
      : avgScore >= 4.5
        ? "success"
        : avgScore >= 3.5
          ? "warning"
          : "danger";
  const toneCls: Record<typeof tone, string> = {
    success: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    danger: "text-red-700 dark:text-red-300",
    neutral: "text-slate-400 dark:text-slate-500",
  };

  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Score promedio
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        {avgScore !== null ? (
          <>
            <span
              className={`text-2xl font-semibold tabular-nums ${toneCls[tone]}`}
            >
              {avgScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              /5
            </span>
          </>
        ) : (
          <span className={`text-2xl font-semibold ${toneCls[tone]}`}>—</span>
        )}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {count} {count === 1 ? "servicio calificado" : "servicios calificados"}
      </div>
    </div>
  );
}
