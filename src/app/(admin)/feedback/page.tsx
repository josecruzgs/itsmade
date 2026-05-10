import { AdminShell } from "@/components/AdminShell";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  BranchRow,
  CustomerRow,
  FeedbackAnswerRow,
  FeedbackRequestStatus,
  NpsBucket,
  ServiceRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface FeedbackRowJoined {
  id: string;
  status: FeedbackRequestStatus;
  score_overall_avg: number | null;
  nps_bucket: NpsBucket | null;
  sent_at: string | null;
  completed_at: string | null;
  expired_at: string | null;
  created_at: string;
  customer: Pick<CustomerRow, "id" | "name" | "whatsapp_phone"> | null;
  branch: Pick<BranchRow, "id" | "name" | "city"> | null;
  service: Pick<ServiceRow, "id" | "name" | "code"> | null;
  feedback_answers: FeedbackAnswerRow[];
}

const statusBadge: Record<FeedbackRequestStatus, string> = {
  pending: "badge-neutral",
  in_progress: "badge-warning",
  completed: "badge-success",
  expired: "badge-neutral",
  escalated: "badge-warning",
  cancelled: "badge-neutral",
};

const statusLabel: Record<FeedbackRequestStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  expired: "Expirada",
  escalated: "Escalada",
  cancelled: "Cancelada",
};

const npsClass: Record<NpsBucket, string> = {
  promoter: "badge-success",
  passive: "badge-warning",
  detractor: "badge bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
};

const QUESTION_LABELS: Record<number, string> = {
  1: "General",
  2: "Puntualidad",
  3: "Calidad",
  4: "Trato",
  5: "Comentario",
};

export default async function FeedbackPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("feedback_requests")
    .select(
      `
      id, status, score_overall_avg, nps_bucket,
      sent_at, completed_at, expired_at, created_at,
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

  const rows = (data ?? []) as unknown as FeedbackRowJoined[];

  // Resumen rapido en tarjetas
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
  };

  return (
    <AdminShell
      title="Feedback"
      description={`${summary.total} solicitudes totales · ${summary.completed} completadas.`}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Promotores" value={summary.promoter} tone="success" />
        <SummaryCard label="Pasivos" value={summary.passive} tone="warning" />
        <SummaryCard label="Detractores" value={summary.detractor} tone="danger" />
        <SummaryCard label="Pendientes" value={summary.pending} tone="neutral" />
        <SummaryCard label="Expirados" value={summary.expired} tone="neutral" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">NPS</th>
                <th className="px-4 py-3 font-medium">Completado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <FeedbackTableRow key={r.id} row={r} />
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Aún no hay solicitudes de feedback. Ve a /services y presiona
                    &quot;Solicitar feedback&quot; en un servicio completado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function FeedbackTableRow({ row }: { row: FeedbackRowJoined }) {
  const sortedAnswers = [...(row.feedback_answers ?? [])].sort(
    (a, b) => a.question_index - b.question_index,
  );

  return (
    <>
      <tr className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
        <td className="px-4 py-3">
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {row.customer?.name ?? "—"}
          </div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {row.customer?.whatsapp_phone ?? ""}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-slate-900 dark:text-slate-100">
            {row.service?.name ?? "—"}
          </div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {row.service?.code ?? ""}
          </div>
        </td>
        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
          {row.branch?.city ?? "—"}
        </td>
        <td className="px-4 py-3">
          <span className={statusBadge[row.status]}>
            {statusLabel[row.status]}
          </span>
        </td>
        <td className="px-4 py-3">
          {row.score_overall_avg !== null ? (
            <span className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
              {row.score_overall_avg.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          {row.nps_bucket ? (
            <span className={npsClass[row.nps_bucket]}>{row.nps_bucket}</span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          {row.completed_at
            ? new Date(row.completed_at).toLocaleString("es-MX")
            : row.expired_at
              ? `Expiró ${new Date(row.expired_at).toLocaleDateString("es-MX")}`
              : row.sent_at
                ? `Enviado ${new Date(row.sent_at).toLocaleDateString("es-MX")}`
                : "—"}
        </td>
      </tr>
      {sortedAnswers.length > 0 ? (
        <tr className="bg-slate-50/40 dark:bg-slate-900/40">
          <td colSpan={7} className="px-4 py-3">
            <details className="group">
              <summary className="cursor-pointer select-none text-xs font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                Ver {sortedAnswers.length}{" "}
                {sortedAnswers.length === 1 ? "respuesta" : "respuestas"}
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {sortedAnswers.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {QUESTION_LABELS[a.question_index] ?? `P${a.question_index}`}
                      </span>
                      {a.normalized_score !== null ? (
                        <span className="badge-brand">{a.normalized_score}/5</span>
                      ) : null}
                    </div>
                    <div className="mt-1 italic text-slate-600 dark:text-slate-400">
                      &ldquo;{a.raw_answer}&rdquo;
                    </div>
                    {a.normalized_text ? (
                      <div className="mt-1 text-slate-500 dark:text-slate-500">
                        {a.normalized_text}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          </td>
        </tr>
      ) : null}
    </>
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
