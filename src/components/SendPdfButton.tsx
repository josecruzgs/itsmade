"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendServicePdfToEmployee } from "@/lib/services/send-pdf";
import type { EmployeeRow } from "@/lib/supabase/types";

/**
 * Boton para enviar la hoja de servicio por WhatsApp a un empleado.
 * Abre un modal con el listado de empleados activos. Tras enviar, refresca
 * /services para reflejar la asignacion.
 */
export function SendPdfButton({
  serviceJobId,
  employees,
  currentlyAssignedId,
}: {
  serviceJobId: string;
  employees: EmployeeRow[];
  currentlyAssignedId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  const labelClass = currentlyAssignedId
    ? "btn-ghost text-xs"
    : "btn-ghost text-xs";
  const labelText = currentlyAssignedId ? "Reenviar" : "Enviar PDF";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={labelClass}
        disabled={employees.length === 0}
        title={
          employees.length === 0
            ? "Registra empleados activos en /employees primero"
            : "Enviar hoja PDF al equipo por WhatsApp"
        }
      >
        {labelText}
      </button>
      {open ? (
        <SendPdfModal
          serviceJobId={serviceJobId}
          employees={employees}
          currentlyAssignedId={currentlyAssignedId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
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
