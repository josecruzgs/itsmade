"use client";

import { useActionState } from "react";
import { updatePassword, type ActionResult } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    updatePassword,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Nueva contraseña
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
          Confirmar contraseña
        </span>
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          className="field"
          placeholder="Repite la contraseña"
        />
      </label>

      {state && !state.ok ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "Actualizando…" : "Actualizar contraseña"}
      </button>
    </form>
  );
}
