"use client";

import {
  reactivateBot,
  closeConversation,
} from "@/lib/conversation/actions";

export function ReactivateButton({ id }: { id: string }) {
  return (
    <form action={reactivateBot} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25"
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
          <path d="M21 12a9 9 0 1 1-3.4-7.05M21 4v5h-5" />
        </svg>
        Reactivar bot
      </button>
    </form>
  );
}

export function CloseConversationButton({ id }: { id: string }) {
  return (
    <form
      action={closeConversation}
      onSubmit={(e) => {
        if (!confirm("¿Cerrar esta conversación? El cliente puede volver a escribir si necesita.")) {
          e.preventDefault();
        }
      }}
      className="inline-flex"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-danger">
        Cerrar
      </button>
    </form>
  );
}
