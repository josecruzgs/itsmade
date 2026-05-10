"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { requestFeedback } from "@/lib/feedback/actions";
import type { ActionResult } from "@/lib/auth/actions";

interface Props {
  serviceJobId: string;
  /** Si ya hay una solicitud abierta para este job, deshabilita el boton. */
  hasOpenRequest?: boolean;
  /** Si ya hay feedback completado, opcionalmente permite re-solicitar. */
  hasCompletedRequest?: boolean;
}

export function RequestFeedbackButton({
  serviceJobId,
  hasOpenRequest,
  hasCompletedRequest,
}: Props) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(requestFeedback, null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) {
        router.refresh();
      }
    }
  }, [state, router]);

  if (hasOpenRequest) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Solicitud abierta
      </span>
    );
  }

  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="service_job_id" value={serviceJobId} />
      <button
        type="submit"
        disabled={isPending}
        className="btn-primary whitespace-nowrap text-xs"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {isPending
          ? "Enviando…"
          : hasCompletedRequest
            ? "Solicitar de nuevo"
            : "Solicitar feedback"}
      </button>
      {state && !state.ok ? (
        <span className="max-w-[280px] text-right text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
      {state?.ok ? (
        <span className="max-w-[280px] text-right text-xs text-emerald-600 dark:text-emerald-400">
          ✓ {state.message}
        </span>
      ) : null}
    </form>
  );
}
