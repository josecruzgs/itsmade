"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getEvolutionStatus,
  logoutEvolution,
  type EvolutionStatus,
} from "@/lib/settings/actions";

export function SettingsEvolution({ initial }: { initial: EvolutionStatus }) {
  const [status, setStatus] = useState<EvolutionStatus>(initial);
  const [refreshing, startRefresh] = useTransition();
  const [actionMsg, setActionMsg] = useState<
    { ok: true; text: string } | { ok: false; text: string } | null
  >(null);

  function refresh() {
    startRefresh(async () => {
      const s = await getEvolutionStatus();
      setStatus(s);
    });
  }

  // Auto-refresh: cada 5s si no esta conectado.
  useEffect(() => {
    if (status.state === "open") return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state]);

  function disconnect() {
    if (
      !confirm(
        `¿Desvincular el dispositivo de WhatsApp?\n\nDejarás de recibir mensajes hasta que escanees el QR de nuevo.`,
      )
    ) {
      return;
    }
    startRefresh(async () => {
      const res = await logoutEvolution();
      setActionMsg(
        res.ok
          ? { ok: true, text: res.message ?? "OK" }
          : { ok: false, text: res.error },
      );
      await new Promise((r) => setTimeout(r, 1000));
      const s = await getEvolutionStatus();
      setStatus(s);
    });
  }

  const stateLabel: Record<EvolutionStatus["state"], { label: string; cls: string }> = {
    open: { label: "Conectado", cls: "badge-success" },
    connecting: { label: "Conectando…", cls: "badge-warning" },
    close: { label: "Desconectado", cls: "badge-warning" },
    unknown: { label: "Sin contacto", cls: "badge-neutral" },
  };
  const sLabel = stateLabel[status.state];

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            WhatsApp (Evolution API)
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Estado de la instancia{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
              {status.instanceName}
            </code>{" "}
            en{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
              {status.apiUrl}
            </code>
          </p>
        </div>
        <span className={sLabel.cls}>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {sLabel.label}
        </span>
      </div>

      {!status.reachable ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <strong>No se pudo contactar a Evolution API.</strong> Verifica que el contenedor está corriendo en el VPS:
          <pre className="mt-2 overflow-x-auto rounded bg-red-100/50 p-2 text-xs dark:bg-red-950/40">
            docker compose -f docker-compose.evolution-only.yml ps
          </pre>
          {status.errorMessage ? (
            <div className="mt-1 truncate font-mono text-xs">{status.errorMessage}</div>
          ) : null}
        </div>
      ) : null}

      {/* Conectado: ficha del usuario WhatsApp */}
      {status.state === "open" ? (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          {status.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={status.profilePicture}
              alt="WhatsApp profile"
              className="h-14 w-14 rounded-full border border-white object-cover shadow-sm"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {status.profileName ?? "WhatsApp conectado"}
            </div>
            {status.number ? (
              <div className="font-mono text-xs text-slate-600 dark:text-slate-400">
                +{status.number}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40"
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {refreshing ? "Desvinculando…" : "Desvincular"}
          </button>
        </div>
      ) : null}

      {/* Desconectado: mostrar QR */}
      {status.reachable && status.state !== "open" ? (
        <div className="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-center">
          <div className="flex h-64 w-64 items-center justify-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-50">
            {status.qrBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  status.qrBase64.startsWith("data:")
                    ? status.qrBase64
                    : `data:image/png;base64,${status.qrBase64}`
                }
                alt="QR de WhatsApp"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                <svg
                  className="animate-spin"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Generando QR…
              </div>
            )}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-400">
            <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              Escanea para vincular
            </h3>
            <ol className="ml-4 list-decimal space-y-1.5">
              <li>Abre WhatsApp en tu teléfono.</li>
              <li>
                Ve a <strong>Configuración → Dispositivos vinculados</strong>.
              </li>
              <li>
                Toca <strong>Vincular un dispositivo</strong> y escanea este QR.
              </li>
            </ol>
            {status.pairingCode ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  o usa el código de vinculación
                </div>
                <div className="mt-1 font-mono text-lg font-semibold tracking-widest text-slate-900 dark:text-slate-100">
                  {status.pairingCode}
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              El QR se actualiza automáticamente. La conexión se detectará en cuanto escanees.
            </p>
          </div>
        </div>
      ) : null}

      {actionMsg ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            actionMsg.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {actionMsg.ok ? "✓ " : ""}
          {actionMsg.text}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {refreshing
            ? "Sincronizando…"
            : status.state !== "open"
              ? "Auto-actualiza cada 5s"
              : "Sincronizado"}
        </span>
        <div className="flex flex-wrap gap-2">
          <a
            href={status.managerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            Abrir Evolution Manager
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M7 7h10v10M7 17 17 7" />
            </svg>
          </a>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="btn-ghost text-xs"
          >
            {refreshing ? "Actualizando…" : "Actualizar ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
