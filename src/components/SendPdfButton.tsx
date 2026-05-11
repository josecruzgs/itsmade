"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendServicePdfToEmployee } from "@/lib/services/send-pdf";
import type { EmployeeRow } from "@/lib/supabase/types";

const ICON_BTN_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";

/**
 * Pareja de botones-icono para una fila de servicio:
 *   - Descargar PDF (link directo a /api/services/[id]/pdf).
 *   - Enviar PDF al equipo via WhatsApp:
 *       · Si el servicio ya tiene empleado asignado -> envia directo sin modal.
 *       · Si no -> abre modal con picker de empleado.
 */
export function SendPdfButton({
  serviceJobId,
  employees,
  currentlyAssignedId,
}: {
  serviceJobId: string;
  employees: EmployeeRow[];
  /** Si esta presente, click en Enviar dispara envio directo a ese empleado. */
  currentlyAssignedId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<"success" | null>(null);

  const activeEmployees = employees.filter((e) => e.active);

  // El boton de envio se deshabilita si no hay nadie asignado Y no hay
  // empleados activos a quien picker.
  const noEmployeesAtAll = !currentlyAssignedId && activeEmployees.length === 0;

  const sendTitle = noEmployeesAtAll
    ? "Registra empleados activos en /employees primero"
    : currentlyAssignedId
      ? "Reenviar hoja al empleado asignado por WhatsApp"
      : "Enviar hoja al equipo por WhatsApp (elegir empleado)";

  function handleSendClick() {
    // Caso 1: ya hay empleado asignado -> envio directo
    if (currentlyAssignedId) {
      startTransition(async () => {
        const res = await sendServicePdfToEmployee({
          serviceJobId,
          employeeId: currentlyAssignedId,
        });
        if (res.ok) {
          setFlash("success");
          setTimeout(() => setFlash(null), 1500);
          router.refresh();
        } else {
          window.alert(res.error ?? "No se pudo enviar.");
        }
      });
      return;
    }
    // Caso 2: sin asignar -> abrir modal de seleccion
    setOpen(true);
  }

  return (
    <>
      <a
        href={`/api/services/${serviceJobId}/pdf`}
        download
        className={ICON_BTN_CLASS}
        title="Descargar hoja PDF"
        aria-label="Descargar hoja PDF"
      >
        <DownloadIcon />
      </a>

      <button
        type="button"
        onClick={handleSendClick}
        className={ICON_BTN_CLASS}
        disabled={noEmployeesAtAll || pending}
        title={sendTitle}
        aria-label={sendTitle}
      >
        {pending ? <SpinnerIcon /> : flash === "success" ? <CheckIcon /> : <SendIcon />}
      </button>

      {open ? (
        <SendPdfModal
          serviceJobId={serviceJobId}
          employees={activeEmployees}
          currentlyAssignedId={currentlyAssignedId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-600 dark:text-emerald-400"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SendPdfModal({
  serviceJobId,
  employees,
  currentlyAssignedId,
  onClose,
}: {
  serviceJobId: string;
  employees: EmployeeRow[];
  currentlyAssignedId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(currentlyAssignedId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  function handleSubmit() {
    if (!selected) {
      setError("Selecciona un empleado.");
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await sendServicePdfToEmployee({
        serviceJobId,
        employeeId: selected,
      });
      if (res.ok) {
        setSuccess(res.message ?? "Enviado.");
        // Pequeno delay para que el usuario vea el feedback antes de cerrar.
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 900);
      } else {
        setError(res.error ?? "No se pudo enviar.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="my-12 w-full max-w-md animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Enviar hoja de servicio
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            Elige al empleado que recibira la hoja PDF por WhatsApp. Quedara
            asignado a este servicio.
          </p>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Empleado <span className="text-red-500">*</span>
            </span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="field"
              disabled={pending}
            >
              <option value="">Selecciona…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                  {emp.position ? ` — ${emp.position}` : ""}
                  {emp.area ? ` (${emp.area})` : ""}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              {success}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !selected}
              className="btn-primary"
            >
              {pending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
