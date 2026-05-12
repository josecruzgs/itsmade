"use client";

import { useState } from "react";
import type { FeedbackRequestStatus, NpsBucket } from "@/lib/supabase/types";
import {
  FeedbackDetailModal,
  type FeedbackDetailRow,
} from "@/components/FeedbackDetailModal";

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

export function FeedbackTable({ rows }: { rows: FeedbackDetailRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = openId ? rows.find((r) => r.id === openId) ?? null : null;

  return (
    <>
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
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {r.customer?.name ?? "—"}
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.customer?.whatsapp_phone ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 dark:text-slate-100">
                      {r.service?.name ?? "—"}
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.service?.code ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {r.branch?.city ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge[r.status]}>
                      {statusLabel[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.score_overall_avg !== null ? (
                      <span className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
                        {r.score_overall_avg.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.nps_bucket ? (
                      <span className={npsClass[r.nps_bucket]}>{r.nps_bucket}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {r.completed_at
                      ? new Date(r.completed_at).toLocaleString("es-MX")
                      : r.expired_at
                        ? `Expiró ${new Date(r.expired_at).toLocaleDateString("es-MX")}`
                        : r.sent_at
                          ? `Enviado ${new Date(r.sent_at).toLocaleDateString("es-MX")}`
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
                      Ver resumen
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
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

      {openRow ? (
        <FeedbackDetailModal row={openRow} onClose={() => setOpenId(null)} />
      ) : null}
    </>
  );
}
