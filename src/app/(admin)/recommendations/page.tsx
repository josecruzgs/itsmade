import { AdminShell } from "@/components/AdminShell";
import { ImprovementReportsList } from "@/components/ImprovementReportsList";
import { RunRecommendationsButton } from "@/components/RunRecommendationsButton";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { ImprovementReportRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  await requireAdmin();

  const sb = supabaseServer();

  const [reportsRes, pendingFeedbackRes] = await Promise.all([
    sb
      .from("improvement_reports")
      .select(
        "id, generated_at, generated_by_profile_id, feedback_count, report_markdown, status, applied_at, applied_by_profile_id, applied_notes",
      )
      .order("generated_at", { ascending: false })
      .limit(100),
    sb
      .from("feedback_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .is("analyzed_in_report_id", null),
  ]);

  if (reportsRes.error) {
    return (
      <AdminShell title="Recomendaciones">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {reportsRes.error.message}
        </div>
      </AdminShell>
    );
  }

  const reports = (reportsRes.data ?? []) as ImprovementReportRow[];
  const pendingFeedbackCount = pendingFeedbackRes.count ?? 0;

  const summary = {
    total: reports.length,
    pendingReports: reports.filter((r) => r.status === "pending").length,
    appliedReports: reports.filter((r) => r.status === "applied").length,
    pendingFeedback: pendingFeedbackCount,
  };

  return (
    <AdminShell
      title="Recomendaciones"
      description={`${summary.total} reportes generados · ${summary.pendingReports} pendientes de aplicar.`}
      actions={<RunRecommendationsButton pendingCount={summary.pendingFeedback} />}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Feedback sin analizar"
          value={summary.pendingFeedback}
          tone={summary.pendingFeedback > 0 ? "brand" : "neutral"}
          hint="Listos para el próximo análisis"
        />
        <StatCard
          label="Reportes totales"
          value={summary.total}
          tone="neutral"
        />
        <StatCard
          label="Mejoras por aplicar"
          value={summary.pendingReports}
          tone="warning"
        />
        <StatCard
          label="Mejoras aplicadas"
          value={summary.appliedReports}
          tone="success"
        />
      </div>

      <ImprovementReportsList reports={reports} />
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "brand" | "neutral";
  hint?: string;
}) {
  const toneCls: Record<typeof tone, string> = {
    success: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    brand: "text-brand-700 dark:text-brand-300",
    neutral: "text-slate-700 dark:text-slate-300",
  };
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls[tone]}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
