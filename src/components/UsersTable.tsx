"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUser,
  deleteUser,
  setUserRole,
  type ActionResult,
} from "@/lib/auth/actions";

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  created_at: string;
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createState, createAction, isCreating] = useActionState<
    ActionResult | null,
    FormData
  >(createUser, null);

  useEffect(() => {
    if (createState?.ok) {
      setCreating(false);
      router.refresh();
    }
  }, [createState, router]);

  return (
    <div className="space-y-5">
      <div className="card flex items-center justify-between gap-3 p-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {users.length} {users.length === 1 ? "usuario" : "usuarios"} con acceso al panel.
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {u.email}
                    </span>
                    {u.id === currentUserId ? (
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        (tú)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {u.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.id === currentUserId ? (
                      <span className={u.role === "admin" ? "badge-brand" : "badge-neutral"}>
                        {u.role}
                      </span>
                    ) : (
                      <RoleSelector id={u.id} role={u.role} />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                    {new Date(u.created_at).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== currentUserId ? (
                      <DeleteUserButton id={u.id} email={u.email} />
                    ) : null}
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Sin usuarios.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {creating ? (
        <CreateUserModal
          state={createState}
          action={createAction}
          isCreating={isCreating}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}

function RoleSelector({ id, role }: { id: string; role: "admin" | "user" }) {
  return (
    <form action={setUserRole} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        defaultValue={role}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
    </form>
  );
}

function DeleteUserButton({ id, email }: { id: string; email: string }) {
  return (
    <form
      action={deleteUser}
      onSubmit={(e) => {
        if (
          !confirm(
            `¿Eliminar al usuario "${email}"?\n\nPerderá acceso al panel y todas sus sesiones serán cerradas.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-danger">
        Eliminar
      </button>
    </form>
  );
}

function CreateUserModal({
  state,
  action,
  isCreating,
  onClose,
}: {
  state: ActionResult | null;
  action: (formData: FormData) => void;
  isCreating: boolean;
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
        className="my-8 w-full max-w-md animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Nuevo usuario
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
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email <span className="text-red-500">*</span>
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="off"
              className="field"
              placeholder="usuario@correo.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Contraseña <span className="text-red-500">*</span>
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="field"
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre completo
            </span>
            <input
              type="text"
              name="full_name"
              maxLength={120}
              className="field"
              placeholder="Opcional"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Rol <span className="text-red-500">*</span>
            </span>
            <select name="role" defaultValue="user" required className="field">
              <option value="user">user — sin acceso a Configuración ni Usuarios</option>
              <option value="admin">admin — acceso total</option>
            </select>
          </label>

          {state && !state.ok ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={isCreating} className="btn-primary">
              {isCreating ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
