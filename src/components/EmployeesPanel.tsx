"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/employees/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type { EmployeeRow } from "@/lib/supabase/types";

export function EmployeesPanel({ employees }: { employees: EmployeeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmployeeRow | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="card flex items-center justify-between gap-3 p-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {employees.length}{" "}
          {employees.length === 1 ? "empleado registrado" : "empleados registrados"}.
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="btn-primary whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo empleado
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Puesto</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Estatus</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {employees.map((e) => (
                <tr
                  key={e.id}
                  className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {e.full_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {e.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {e.area ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {e.whatsapp_phone}
                  </td>
                  <td className="px-4 py-3">
                    <span className={e.active ? "badge-success" : "badge-neutral"}>
                      {e.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="btn-ghost text-xs"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Aun no hay empleados. Presiona &quot;Nuevo empleado&quot;.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <EmployeeModal
          employee={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function EmployeeModal({
  employee,
  onClose,
}: {
  employee: EmployeeRow | null;
  onClose: () => void;
}) {
  const isNew = employee === null;
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    isNew ? createEmployee : updateEmployee,
    null,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
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
        className="my-8 w-full max-w-lg animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isNew ? "Nuevo empleado" : "Editar empleado"}
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

        <form action={action} className="px-6 py-5">
          {!isNew ? <input type="hidden" name="id" value={employee.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nombre completo <span className="text-red-500">*</span>
              </span>
              <input
                name="full_name"
                required
                defaultValue={employee?.full_name ?? ""}
                className="field"
                placeholder="Maria Lopez"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Puesto
              </span>
              <input
                name="position"
                defaultValue={employee?.position ?? ""}
                className="field"
                placeholder="Operadora, Supervisor, Lider de cuadrilla"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Area
              </span>
              <input
                name="area"
                defaultValue={employee?.area ?? ""}
                className="field"
                placeholder="Residencial, Comercial, Industrial"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                WhatsApp <span className="text-red-500">*</span>
              </span>
              <input
                name="whatsapp_phone"
                required
                type="tel"
                defaultValue={employee?.whatsapp_phone ?? ""}
                className="field"
                placeholder="5216861234567"
              />
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                Con codigo de pais (sin +). 10-15 digitos.
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Notas internas
              </span>
              <textarea
                name="notes"
                defaultValue={employee?.notes ?? ""}
                rows={2}
                maxLength={500}
                className="field resize-y"
                placeholder="Cualquier dato util sobre este empleado."
              />
            </label>

            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                name="active"
                defaultChecked={employee?.active ?? true}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Activo (puede recibir asignaciones)
              </span>
            </label>
          </div>

          {state && !state.ok ? (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div>
              {!isNew ? (
                <form
                  action={async (fd) => {
                    if (
                      typeof window !== "undefined" &&
                      !window.confirm("¿Eliminar este empleado?")
                    ) {
                      return;
                    }
                    await deleteEmployee(fd);
                    onClose();
                  }}
                >
                  <input type="hidden" name="id" value={employee.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Eliminar
                  </button>
                </form>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancelar
              </button>
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending
                  ? "Guardando…"
                  : isNew
                    ? "Registrar"
                    : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
