"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  updateCustomer,
  getCustomerServices,
  type CustomerServiceMini,
} from "@/lib/customers/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type { ClientRow } from "@/components/ClientsPanel";
import type { ServiceJobStatus } from "@/lib/supabase/types";

const STATUS_LABEL: Record<ServiceJobStatus, string> = {
  scheduled: "Pendiente",
  in_progress: "En proceso",
  completed: "Realizado",
  cancelled: "Cancelado",
};

const STATUS_BADGE: Record<ServiceJobStatus, string> = {
  scheduled: "badge-neutral",
  in_progress: "badge-warning",
  completed: "badge-success",
  cancelled:
    "badge bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
};

export function ClientDetailModal({
  client,
  onClose,
}: {
  client: ClientRow;
  onClose: () => void;
}) {
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    updateCustomer,
    null,
  );

  const [services, setServices] = useState<CustomerServiceMini[]>([]);
  const [totalServices, setTotalServices] = useState<number>(
    client.total_services,
  );
  const [page, setPage] = useState(1);
  const [loadingServices, startLoading] = useTransition();
  const [servicesError, setServicesError] = useState<string | null>(null);

  useEffect(() => {
    setServicesError(null);
    startLoading(async () => {
      try {
        const res = await getCustomerServices(client.id, page);
        setServices(res.services);
        setTotalServices(res.totalCount);
      } catch (e) {
        setServicesError((e as Error).message);
      }
    });
  }, [client.id, page]);

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

  const totalPages = Math.max(1, Math.ceil(totalServices / 5));
  const firstShown = services.length > 0 ? (page - 1) * 5 + 1 : 0;
  const lastShown = (page - 1) * 5 + services.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Detalle del cliente
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Cliente desde{" "}
              {new Date(client.created_at).toLocaleDateString("es-MX")}
            </p>
          </div>
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

        {/* === EDIT FORM === */}
        <form action={action} className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <input type="hidden" name="id" value={client.id} />
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Información del cliente
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="name"
              label="Nombre completo"
              required
              defaultValue={client.name ?? ""}
            />
            <Field
              name="company_name"
              label="Empresa"
              defaultValue={client.company_name ?? ""}
              placeholder="Opcional, si es cliente empresa"
            />
            <Field
              name="whatsapp_phone"
              label="WhatsApp"
              required
              type="tel"
              defaultValue={client.whatsapp_phone}
              hint="Con código de país (sin +). Ej: 521 + 10 dígitos."
            />
            <Field
              name="email"
              label="Email"
              type="email"
              defaultValue={client.email ?? ""}
            />
          </div>

          {state && !state.ok ? (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </div>
          ) : null}
          {state?.ok ? (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              ✓ {state.message}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>

        {/* === SERVICES TABLE === */}
        <div className="px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Servicios{" "}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {totalServices}
              </span>
            </div>
          </div>

          {servicesError ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              Error: {servicesError}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/60 text-left uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Servicio</th>
                    <th className="px-3 py-2 font-medium">Sucursal</th>
                    <th className="px-3 py-2 font-medium">Costo</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Feedback</th>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingServices && services.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-400"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : services.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        Este cliente aún no tiene servicios registrados.
                      </td>
                    </tr>
                  ) : (
                    services.map((s) => (
                      <tr
                        key={s.id}
                        className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {s.service?.name ?? "—"}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            {s.service?.code ?? ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {s.branch?.city ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
                          {s.cost_mxn !== null
                            ? `$${s.cost_mxn.toLocaleString("es-MX")}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={STATUS_BADGE[s.status]}>
                            {STATUS_LABEL[s.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <FeedbackBadgeMini requests={s.feedback_requests ?? []} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">
                          {s.completed_at
                            ? new Date(s.completed_at).toLocaleDateString("es-MX")
                            : s.scheduled_at
                              ? new Date(s.scheduled_at).toLocaleDateString("es-MX")
                              : new Date(s.created_at).toLocaleDateString("es-MX")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalServices > 5 ? (
            <nav className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {firstShown}–{lastShown}
                </strong>{" "}
                de{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {totalServices}
                </strong>
              </span>
              <div className="flex items-center gap-1">
                <PageButton
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loadingServices}
                  ariaLabel="Página anterior"
                >
                  ‹
                </PageButton>
                <span className="px-2 text-xs text-slate-600 dark:text-slate-300">
                  Página {page} de {totalPages}
                </span>
                <PageButton
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loadingServices}
                  ariaLabel="Página siguiente"
                >
                  ›
                </PageButton>
              </div>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  type = "text",
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="field"
      />
      {hint ? (
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-white px-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function FeedbackBadgeMini({
  requests,
}: {
  requests: Array<{ status: string }>;
}) {
  if (requests.length === 0) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  if (requests.find((r) => ["pending", "in_progress"].includes(r.status))) {
    return <span className="badge-warning">En curso</span>;
  }
  if (requests.find((r) => r.status === "completed")) {
    return <span className="badge-success">Completada</span>;
  }
  if (requests.find((r) => r.status === "escalated")) {
    return <span className="badge-warning">Escalada</span>;
  }
  if (requests.find((r) => r.status === "expired")) {
    return <span className="badge-neutral">Expirada</span>;
  }
  if (requests.find((r) => r.status === "cancelled")) {
    return <span className="badge-neutral">Cancelada</span>;
  }
  return <span className="text-[10px] text-slate-400">—</span>;
}
