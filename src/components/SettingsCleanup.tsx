"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  executeCleanup,
  getCleanupPreview,
  type CleanupCounts,
  type CleanupResult,
} from "@/lib/settings/actions";

const PRESETS = [24, 48, 72, 168, 720]; // 1d, 2d, 3d, 7d, 30d

export function SettingsCleanup({ initial }: { initial: CleanupCounts }) {
  const router = useRouter();
  const [hours, setHours] = useState<number>(72);
  const [opts, setOpts] = useState({ messages: true, conversations: true });
  const [counts, setCounts] = useState<CleanupCounts>(initial);
  const [refreshing, startRefresh] = useTransition();
  const [running, startRun] = useTransition();
  const [result, setResult] = useState<CleanupResult | null>(null);

  function refresh(h: number) {
    setResult(null);
    startRefresh(async () => {
      const c = await getCleanupPreview(h);
      setCounts(c);
    });
  }

  useEffect(() => {
    const t = setTimeout(() => refresh(hours), 350);
    return () => clearTimeout(t);
  }, [hours]);

  function execute() {
    const summary = [
      opts.messages && counts.messages > 0 ? `${counts.messages} mensajes` : null,
      opts.conversations && counts.conversations > 0
        ? `${counts.conversations} conversaciones`
        : null,
    ]
      .filter(Boolean)
      .join(", ");
    if (!summary) {
      alert("Nada seleccionado o nada para eliminar.");
      return;
    }
    if (
      !confirm(
        `¿Eliminar ${summary} con más de ${hours} horas?\n\nEsta acción NO se puede deshacer.`,
      )
    ) {
      return;
    }
    startRun(async () => {
      const res = await executeCleanup(hours, opts);
      setResult(res);
      if (res.ok) {
        const c = await getCleanupPreview(hours);
        setCounts(c);
        router.refresh();
      }
    });
  }

  const totalSelected =
    (opts.messages ? counts.messages : 0) +
    (opts.conversations ? counts.conversations : 0);

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Limpieza de base de datos
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Elimina conversaciones cerradas/escaladas y mensajes antiguos. Los datos
            de servicios, sucursales, catálogo, feedback y usuarios <strong>nunca</strong> se tocan.
          </p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:bg-red-500/15 dark:text-red-300">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
          </svg>
        </span>
      </div>

      <div className="mb-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Antigüedad mínima
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={8760}
              step={1}
              value={hours}
              onChange={(e) =>
                setHours(Math.max(1, Number(e.target.value) || 72))
              }
              className="field max-w-[120px]"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">horas</span>
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
              ≈ {formatDuration(hours)}
            </span>
            <div className="ml-auto flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setHours(p)}
                  className={`rounded-md px-2 py-1 text-xs transition ${
                    hours === p
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {p}h
                </button>
              ))}
            </div>
          </div>
        </label>
      </div>

      <div className="space-y-2">
        <CleanupRow
          checked={opts.messages}
          onChange={(v) => setOpts({ ...opts, messages: v })}
          title="Mensajes"
          description="Todo el historial de mensajes (entrantes y salientes) más antiguo que el cutoff."
          count={counts.messages}
          loading={refreshing}
        />
        <CleanupRow
          checked={opts.conversations}
          onChange={(v) => setOpts({ ...opts, conversations: v })}
          title="Conversaciones cerradas"
          description="Solo conversaciones con status closed o escalated. Sus mensajes se eliminan también (CASCADE)."
          count={counts.conversations}
          loading={refreshing}
        />
      </div>

      {result && result.ok ? (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ {result.message}
        </div>
      ) : null}
      {result && !result.ok ? (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {result.error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Se eliminarán{" "}
          <strong className="text-slate-900 dark:text-slate-100">
            {totalSelected}
          </strong>{" "}
          registros en total.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refresh(hours)}
            disabled={refreshing}
            className="btn-ghost"
          >
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={execute}
            disabled={running || totalSelected === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {running ? "Limpiando…" : "Vaciar seleccionadas"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CleanupRow({
  checked,
  onChange,
  title,
  description,
  count,
  loading,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
  count: number;
  loading: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
        checked
          ? "border-brand-300 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/5"
          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/50"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-800"
      />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {title}
          </span>
          {loading ? (
            <span className="text-xs text-slate-400">…</span>
          ) : (
            <span className={count > 0 ? "badge-warning" : "badge-neutral"}>
              {count} {count === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </label>
  );
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = hours / 24;
  if (days < 7) return `${roundOne(days)} ${days === 1 ? "día" : "días"}`;
  if (days < 30) return `${roundOne(days / 7)} semanas`;
  return `${roundOne(days / 30)} meses`;
}

function roundOne(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
