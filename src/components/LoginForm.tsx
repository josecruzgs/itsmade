"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type ActionResult } from "@/lib/auth/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    signIn,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

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

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Contraseña</span>
          <Link
            href="/forgot-password"
            className="text-xs font-normal text-brand-600 hover:underline dark:text-brand-400"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="field"
          placeholder="••••••••"
        />
      </label>

      {state && !state.ok ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
