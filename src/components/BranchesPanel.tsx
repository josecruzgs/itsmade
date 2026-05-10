"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBranch,
  updateBranch,
  toggleBranchActive,
  deleteBranch,
} from "@/lib/branches/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type { BranchRow } from "@/lib/supabase/types";

export function BranchesPanel({ branches }: { branches: BranchRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BranchRow | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="card flex items-center justify-between gap-3 p-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {branches.length}{" "}
          {branches.length === 1 ? "sucursal registrada" : "sucursales registradas"}.
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="btn-primary whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nueva sucursal
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Ciudad</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Estatus</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {branches.map((b) => (
                <tr
                  key={b.id}
                  className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {b.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {b.city}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {b.state ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {b.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={b.active ? "badge-success" : "badge-neutral"}>
                      {b.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(b)}
                        className="btn-ghost text-xs"
                      >
                        Editar
                      </button>
                      <form action={toggleBranchActive} className="inline-flex">
                        <input type="hidden" name="id" value={b.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={String(b.active)}
                        />
                        <button type="submit" className="btn-ghost text-xs">
                          {b.active ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                      <form
                        action={deleteBranch}
                        onSubmit={(e) => {
                          if (
                            !confirm(
                              `¿Eliminar la sucursal ${b.name}? Si tiene servicios registrados, esta acción fallará.`,
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                        className="inline-flex"
                      >
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" className="btn-danger">
                          Eliminar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {branches.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Sin sucursales. Crea la primera con el botón superior.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <BranchModal
          branch={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function BranchModal({
  branch,
  onClose,
}: {
  branch: BranchRow | null;
  onClose: () => void;
}) {
  const isNew = branch === null;
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    isNew ? createBranch : updateBranch,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      onClose();
    }
  }, [state, onClose]);

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
        className="my-8 w-full max-w-md animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isNew ? "Nueva sucursal" : "Editar sucursal"}
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
        <form action={action} className="space-y-4 px-6 py-5">
          {!isNew ? <input type="hidden" name="id" value={branch.id} /> : null}
          <Field
            name="name"
            label="Nombre"
            required
            defaultValue={branch?.name ?? ""}
          />
          <Field
            name="city"
            label="Ciudad"
            required
            defaultValue={branch?.city ?? ""}
          />
          <Field name="state" label="Estado" defaultValue={branch?.state ?? ""} />
          <Field name="phone" label="Teléfono" defaultValue={branch?.phone ?? ""} />

          {state && !state.ok ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? "Guardando…" : isNew ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="field"
      />
    </label>
  );
}
