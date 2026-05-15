"use client";

import { useEffect } from "react";
import type {
  BranchRow,
  CustomerRow,
  FeedbackAnswerRow,
  FeedbackRequestStatus,
  NpsBucket,
  ServiceRow,
} from "@/lib/supabase/types";

export interface FeedbackDetailRow {
  id: string;
  status: FeedbackRequestStatus;
  score_overall_avg: number | null;
  nps_bucket: NpsBucket | null;
  sent_at: string | null;
  completed_at: string | null;
  expired_at: string | null;
  created_at: string;
  summary: string | null;
  summary_generated_at: string | null;
  analyzed_in_report_id: string | null;
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
  detractor:
    "badge bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
};

const npsLabel: Record<NpsBucket, string> = {
  promoter: "Muy satisfecho",
  passive: "Satisfecho",
  detractor: "Insatisfecho",
};

const QUESTION_LABELS: Record<number, string> = {
  1: "General",
  2: "Puntualidad",
  3: "Calidad",
  4: "Trato",
  5: "Comentario",
};

export function FeedbackDetailModal({
  row,
  onClose,
}: {
  row: FeedbackDetailRow;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const sortedAnswers = [...(row.feedback_answers ?? [])].sort(
    (a, b) => a.question_index - b.question_index,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
              {row.customer?.name ?? "—"}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {row.customer?.whatsapp_phone ?? ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Meta */}
        <div className="grid gap-3 border-b border-slate-200 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <Meta label="Servicio" value={row.service?.name ?? "—"} hint={row.service?.code ?? ""} />
          <Meta label="Sucursal" value={row.branch?.city ?? "—"} hint={row.branch?.name ?? ""} />
          <Meta
            label="Estado"
            valueNode={
              <span className={statusBadge[row.status]}>{statusLabel[row.status]}</span>
            }
          />
          <Meta
            label="Score / NPS"
            valueNode={
              <div className="flex items-center gap-2">
                {row.score_overall_avg !== null ? (
                  <span className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
                    {row.score_overall_avg.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
                {row.nps_bucket ? (
                  <span className={npsClass[row.nps_bucket]}>
                    {npsLabel[row.nps_bucket]}
                  </span>
                ) : null}
              </div>
            }
          />
        </div>

        {/* Resumen */}
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Resumen de la conversación
            </div>
            {row.summary_generated_at ? (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Generado{" "}
                {new Date(row.summary_generated_at).toLocaleString("es-MX")}
              </span>
            ) : null}
          </div>
          {row.summary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {row.summary}
            </p>
          ) : (
            <p className="text-sm italic text-slate-500 dark:text-slate-400">
              {row.status === "completed"
                ? "Sin resumen disponible para esta solicitud."
                : "El resumen se genera al completarse la encuesta."}
            </p>
          )}
        </div>

        {/* Respuestas */}
        <div className="px-6 py-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Respuestas{" "}
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {sortedAnswers.length}
            </span>
          </div>
          {sortedAnswers.length === 0 ? (
            <p className="text-sm italic text-slate-500 dark:text-slate-400">
              Aún no hay respuestas registradas.
            </p>
          ) : (
            <div className="space-y-3">
              {/* P1-P4: ratings compactos en un row */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sortedAnswers
                  .filter((a) => a.question_index >= 1 && a.question_index <= 4)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {QUESTION_LABELS[a.question_index] ?? `P${a.question_index}`}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        {a.normalized_score !== null ? (
                          <>
                            <span className="font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                              {a.normalized_score}
                            </span>
                            <span className="text-xs text-slate-400">/5</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* P5: comentario libre, fila propia */}
              {sortedAnswers
                .filter((a) => a.question_index === 5)
                .map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {QUESTION_LABELS[a.question_index] ?? "Comentario"}
                    </div>
                    <div className="mt-1 italic text-sm text-slate-700 dark:text-slate-300">
                      &ldquo;{a.raw_answer}&rdquo;
                    </div>
                    {a.normalized_text &&
                    a.normalized_text !== a.raw_answer ? (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {a.normalized_text}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  hint,
  valueNode,
}: {
  label: string;
  value?: string;
  hint?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">
        {valueNode ?? value ?? "—"}
      </div>
      {hint ? (
        <div className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
