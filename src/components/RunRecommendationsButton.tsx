"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { runRecommendationsAgent } from "@/lib/recommendations/actions";
import type { ActionResult } from "@/lib/auth/actions";

interface Props {
  /** Si no hay feedback pendiente, deshabilita el boton. */
  pendingCount: number;
}

export function RunRecommendationsButton({ pendingCount }: Props) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(async () => runRecommendationsAgent(), null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) router.refresh();
    }
  }, [state, router]);

  const disabled = isPending || pendingCount === 0;

  return (
    <form action={action} className="flex flex-col items-start gap-1.5">
      <button
        type="submit"
        disabled={disabled}
        className="btn-primary"
        title={
          pendingCount === 0
            ? "No hay feedback sin analizar"
            : `Analizar ${pendingCount} feedback`
        }
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
          aria-hidden
        >
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
        </svg>
        {isPending
          ? "Analizando…"
          : pendingCount === 0
            ? "Sin feedback nuevo"
            : `Generar análisis (${pendingCount})`}
      </button>
      {state && !state.ok ? (
        <span className="max-w-md text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
      {state?.ok ? (
        <span className="max-w-md text-xs text-emerald-600 dark:text-emerald-400">
          ✓ {state.message}
        </span>
      ) : null}
    </form>
  );
}
