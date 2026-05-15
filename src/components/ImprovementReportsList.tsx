"use client";

import { useEffect, useState } from "react";
import type {
  ImprovementReportRow,
  ImprovementReportStatus,
} from "@/lib/supabase/types";
import {
  markReportApplied,
  markReportPending,
} from "@/lib/recommendations/actions";

const statusBadge: Record<ImprovementReportStatus, string> = {
  pending: "badge-warning",
  applied: "badge-success",
};

const statusLabel: Record<ImprovementReportStatus, string> = {
  pending: "Mejoras por aplicar",
  applied: "Mejoras aplicadas",
};

export function ImprovementReportsList({
  reports,
}: {
  reports: ImprovementReportRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = openId ? reports.find((r) => r.id === openId) ?? null : null;

  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Reporte</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Feedback analizado</th>
                <th className="px-4 py-3 font-medium">Generado</th>
                <th className="px-4 py-3 font-medium">Aplicado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.map((r) => (
                <tr
                  key={r.id}
                  id={`report-${r.id}`}
                  onClick={() => setOpenId(r.id)}
                  className="cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      Reporte de mejoras
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {r.id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge[r.status]}>
                      {statusLabel[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {r.feedback_count}{" "}
                    {r.feedback_count === 1 ? "feedback" : "feedbacks"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(r.generated_at).toLocaleString("es-MX")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {r.applied_at
                      ? new Date(r.applied_at).toLocaleString("es-MX")
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(r.id);
                      }}
                      className="text-xs font-medium text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Ver reporte
                    </button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Aún no hay reportes. Presiona &quot;Generar análisis&quot;
                    para crear el primero.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {openRow ? (
        <ReportModal report={openRow} onClose={() => setOpenId(null)} />
      ) : null}
    </>
  );
}

function ReportModal({
  report,
  onClose,
}: {
  report: ImprovementReportRow;
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Reporte de mejoras
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Generado{" "}
              {new Date(report.generated_at).toLocaleString("es-MX")} ·{" "}
              {report.feedback_count}{" "}
              {report.feedback_count === 1 ? "feedback" : "feedbacks"}{" "}
              analizado
              {report.feedback_count === 1 ? "" : "s"}
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

        {/* Estado */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
          <span className={statusBadge[report.status]}>
            {statusLabel[report.status]}
          </span>
          {report.applied_at ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Aplicado el {new Date(report.applied_at).toLocaleString("es-MX")}
            </span>
          ) : null}
        </div>

        {/* Markdown */}
        <div className="px-6 py-5">
          <MarkdownReport text={report.report_markdown} />
        </div>

        {/* Notas de aplicacion (si las hay) */}
        {report.applied_notes ? (
          <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Notas de aplicación
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
              {report.applied_notes}
            </p>
          </div>
        ) : null}

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          {report.status === "pending" ? (
            <ApplyForm reportId={report.id} onDone={onClose} />
          ) : (
            <form action={markReportPending}>
              <input type="hidden" name="id" value={report.id} />
              <button type="submit" className="btn-ghost text-xs">
                Revertir a pendiente
              </button>
            </form>
          )}
          <button type="button" onClick={onClose} className="btn-ghost">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplyForm({
  reportId,
  onDone,
}: {
  reportId: string;
  onDone: () => void;
}) {
  return (
    <form
      action={async (fd) => {
        await markReportApplied(fd);
        onDone();
      }}
      className="flex flex-1 items-end gap-2"
    >
      <input type="hidden" name="id" value={reportId} />
      <div className="flex-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Notas (opcional)
        </label>
        <input
          type="text"
          name="notes"
          placeholder="¿Qué cambios se implementaron?"
          className="field mt-1 text-xs"
        />
      </div>
      <button type="submit" className="btn-primary text-xs">
        Marcar como aplicado
      </button>
    </form>
  );
}

/**
 * Renderer markdown minimal — solo H2 (`## `), bullets (`- `) y bold (`**...**`).
 * El texto viene de nuestro propio agente con prompt restringido a ese formato.
 * Render seguro: no usamos dangerouslySetInnerHTML, todo via React nodes.
 */
function MarkdownReport({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    const items = listBuffer.slice();
    listBuffer = [];
    nodes.push(
      <ul
        key={`ul-${nodes.length}`}
        className="my-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
      >
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h3
          key={`h-${nodes.length}`}
          className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wider text-slate-900 first:mt-0 dark:text-slate-100"
        >
          {line.slice(3).trim()}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2).trim());
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    flushList();
    nodes.push(
      <p
        key={`p-${nodes.length}`}
        className="my-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
      >
        {renderInline(line)}
      </p>,
    );
  }
  flushList();

  return <div>{nodes}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
