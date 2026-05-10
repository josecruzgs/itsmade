"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ActionResult } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    requestPasswordReset,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="field"
          placeholder="tu@correo.com"
        />
      </label>

      {state && state.ok ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ {state.message}
        </div>
      ) : null}
      {state && !state.ok ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "Enviando…" : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
