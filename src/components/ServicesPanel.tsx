"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { RequestFeedbackButton } from "@/components/RequestFeedbackButton";
import { SendPdfButton } from "@/components/SendPdfButton";
import {
  createServiceJob,
  updateServiceJob,
  changeServiceJobStatus,
  deleteServiceJobWithPassword,
} from "@/lib/services/actions";
import {
  searchCustomers,
  type CustomerSearchResult,
} from "@/lib/customers/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type {
  BranchRow,
  EmployeeRow,
  ServiceCategoryRow,
  ServiceJobStatus,
  ServiceRow,
} from "@/lib/supabase/types";

export interface ServicesQueryParams {
  q: string;
  status: string;
  branch: string;
  sort: "created" | "customer" | "service" | "branch" | "cost" | "status";
  dir: "asc" | "desc";
}

export interface ServiceJobJoined {
  id: string;
  scheduled_at: string | null;
  completed_at: string | null;
  status: ServiceJobStatus;
  notes: string | null;
  address: string | null;
  cost_mxn: number | null;
  created_at: string;
  assigned_employee_id: string | null;
  pdf_sent_at: string | null;
  customer: {
    id: string;
    name: string | null;
    company_name: string | null;
    whatsapp_phone: string;
    email: string | null;
  } | null;
  branch: { id: string; name: string; city: string } | null;
  service: { id: string; name: string; code: string; category_id: string } | null;
  assigned_employee: { id: string; full_name: string; position: string | null } | null;
  feedback_requests: Array<{ id: string; status: string }>;
}

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
  cancelled: "badge bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
};

export function ServicesPanel({
  jobs,
  branches,
  categories,
  services,
  employees,
  currentParams,
}: {
  jobs: ServiceJobJoined[];
  branches: BranchRow[];
  categories: ServiceCategoryRow[];
  services: ServiceRow[];
  employees: EmployeeRow[];
  currentParams: ServicesQueryParams;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ServiceJobJoined | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="card flex items-center justify-between gap-3 p-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {jobs.length}{" "}
          {jobs.length === 1 ? "servicio en esta página" : "servicios en esta página"}.
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="btn-primary whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo servicio
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <SortableHeader
                  column="customer"
                  label="Cliente"
                  current={currentParams}
                />
                <SortableHeader
                  column="service"
                  label="Servicio"
                  current={currentParams}
                />
                <SortableHeader
                  column="branch"
                  label="Sucursal"
                  current={currentParams}
                />
                <SortableHeader
                  column="cost"
                  label="Costo"
                  current={currentParams}
                />
                <SortableHeader
                  column="status"
                  label="Estado"
                  current={currentParams}
                />
                <SortableHeader
                  column="created"
                  label="Fecha"
                  current={currentParams}
                />
                <th className="px-4 py-3 font-medium">Feedback</th>
                <th className="px-4 py-3 font-medium">Asignado a</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.map((j) => (
                <ServiceRowItem
                  key={j.id}
                  job={j}
                  employees={employees}
                  onEdit={() => setEditing(j)}
                />
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Sin servicios registrados todavía. Presiona &quot;Nuevo servicio&quot; para empezar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <ServiceJobModal
          job={editing === "new" ? null : editing}
          branches={branches}
          categories={categories}
          services={services}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ServiceRowItem({
  job,
  employees,
  onEdit,
}: {
  job: ServiceJobJoined;
  employees: EmployeeRow[];
  onEdit: () => void;
}) {
  const openReq = job.feedback_requests?.find((r) =>
    ["pending", "in_progress"].includes(r.status),
  );
  const completedReq = job.feedback_requests?.find(
    (r) => r.status === "completed",
  );

  return (
    <tr className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {job.customer?.name ?? "—"}
        </div>
        {job.customer?.company_name ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {job.customer.company_name}
          </div>
        ) : null}
        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {job.customer?.whatsapp_phone ?? ""}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-slate-900 dark:text-slate-100">
          {job.service?.name ?? "—"}
        </div>
        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {job.service?.code ?? ""}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
        {job.branch?.city ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
        {job.cost_mxn !== null
          ? `$${job.cost_mxn.toLocaleString("es-MX")}`
          : "—"}
      </td>
      <td className="px-4 py-3">
        <span className={STATUS_BADGE[job.status]}>{STATUS_LABEL[job.status]}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        {job.completed_at
          ? `Realizado ${new Date(job.completed_at).toLocaleDateString("es-MX")}`
          : job.scheduled_at
            ? `Programado ${new Date(job.scheduled_at).toLocaleDateString("es-MX")}`
            : "—"}
      </td>
      <td className="px-4 py-3">
        <FeedbackStatusCell requests={job.feedback_requests ?? []} />
      </td>
      <td className="px-4 py-3">
        {job.assigned_employee ? (
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {job.assigned_employee.full_name}
            </div>
            {job.assigned_employee.position ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {job.assigned_employee.position}
              </div>
            ) : null}
            {job.pdf_sent_at ? (
              <div className="text-xs text-slate-400">
                PDF enviado{" "}
                {new Date(job.pdf_sent_at).toLocaleDateString("es-MX")}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-xs italic text-slate-400">Sin asignar</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          {job.status === "completed" ? (
            <RequestFeedbackButton
              serviceJobId={job.id}
              hasOpenRequest={Boolean(openReq)}
              hasCompletedRequest={Boolean(completedReq) && !openReq}
            />
          ) : null}

          <SendPdfButton
            serviceJobId={job.id}
            employees={employees}
            currentlyAssignedId={job.assigned_employee_id}
          />

          <button
            type="button"
            onClick={onEdit}
            className="btn-ghost text-xs"
          >
            Editar
          </button>
        </div>
      </td>
    </tr>
  );
}

export interface ServiceJobModalInitialCustomer {
  id?: string;
  name: string | null;
  company_name: string | null;
  whatsapp_phone: string;
  email: string | null;
}

export function ServiceJobModal({
  job,
  initialCustomer,
  initialNotes,
  intakeId,
  branches,
  categories,
  services,
  onClose,
}: {
  job: ServiceJobJoined | null;
  /** Prellena datos de cliente al crear nuevo servicio (ej: desde /clients o /intake). */
  initialCustomer?: ServiceJobModalInitialCustomer | null;
  /** Prellena notas (ej: descripcion del intake al convertir a servicio). */
  initialNotes?: string | null;
  /** Si esta presente, el form lo manda como hidden field para que createServiceJob
   *  marque ese intake como 'converted' y enlace el service_job creado. */
  intakeId?: string | null;
  branches: BranchRow[];
  categories: ServiceCategoryRow[];
  services: ServiceRow[];
  onClose: () => void;
}) {
  const isNew = job === null;
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    isNew ? createServiceJob : updateServiceJob,
    null,
  );

  // Cliente actualmente prellenado (puede venir del prop, o ser uno elegido
  // desde el picker). El formKey se incrementa al cambiar para forzar remount
  // de los inputs uncontrolled y que tomen el nuevo defaultValue.
  const [pickedCustomer, setPickedCustomer] = useState<
    ServiceJobModalInitialCustomer | null
  >(initialCustomer ?? null);
  const [formKey, setFormKey] = useState(0);

  function handlePickCustomer(c: CustomerSearchResult) {
    setPickedCustomer({
      id: c.id,
      name: c.name,
      company_name: c.company_name,
      whatsapp_phone: c.whatsapp_phone,
      email: c.email,
    });
    setFormKey((k) => k + 1);
  }

  function handleClearCustomer() {
    setPickedCustomer(null);
    setFormKey((k) => k + 1);
  }

  // Estado local para la cascada categoría → servicio.
  const initialServiceId = job?.service?.id ?? "";
  const initialCategoryId = useMemo(() => {
    if (job?.service?.category_id) return job.service.category_id;
    return "";
  }, [job?.service?.category_id]);

  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [serviceId, setServiceId] = useState<string>(initialServiceId);

  const visibleServices = useMemo(() => {
    const filtered = categoryId
      ? services.filter((s) => s.category_id === categoryId && s.active)
      : services.filter((s) => s.active);
    // Asegurar que el servicio actual aparezca aunque sea inactivo o de otra categoría.
    if (initialServiceId && !filtered.some((s) => s.id === initialServiceId)) {
      const current = services.find((s) => s.id === initialServiceId);
      if (current) return [...filtered, current];
    }
    return filtered;
  }, [categoryId, services, initialServiceId]);

  // Si el usuario cambia categoría y el servicio actual ya no aplica, lo limpiamos.
  useEffect(() => {
    if (!serviceId) return;
    const stillValid = visibleServices.some((s) => s.id === serviceId);
    if (!stillValid) setServiceId("");
  }, [categoryId, visibleServices, serviceId]);

  useEffect(() => {
    if (state?.ok) onClose();
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

  // Para datetime-local, el input necesita formato YYYY-MM-DDTHH:mm sin zona.
  const scheduledLocal = job?.scheduled_at
    ? toDatetimeLocalString(new Date(job.scheduled_at))
    : "";

  // Sucursales visibles: activas + la actual (aunque esté inactiva, para edit).
  const visibleBranches = useMemo(() => {
    const filtered = branches.filter((b) => b.active);
    if (job?.branch?.id && !filtered.some((b) => b.id === job.branch?.id)) {
      const current = branches.find((b) => b.id === job.branch?.id);
      if (current) return [...filtered, current];
    }
    return filtered;
  }, [branches, job?.branch?.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isNew ? "Nuevo servicio" : "Editar servicio"}
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

        {!isNew && job ? (
          <ModalActionBar
            job={job}
            onSuccess={onClose}
          />
        ) : null}

        {/* Picker de cliente existente (solo al crear nuevo). */}
        {isNew ? (
          <CustomerPicker
            picked={pickedCustomer}
            onPick={handlePickCustomer}
            onClear={handleClearCustomer}
          />
        ) : null}

        <form key={formKey} action={action} className="px-6 py-5">
          {!isNew ? <input type="hidden" name="id" value={job.id} /> : null}
          {isNew && intakeId ? (
            <input type="hidden" name="intake_id" value={intakeId} />
          ) : null}

          {/* === CLIENTE === */}
          <Section
            title={
              isNew && pickedCustomer
                ? "Cliente (prellenado desde existente)"
                : "Cliente"
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="customer_name"
                label="Nombre completo"
                required
                defaultValue={
                  job?.customer?.name ?? pickedCustomer?.name ?? ""
                }
                placeholder="Ricardo Pérez"
              />
              <Field
                name="customer_company"
                label="Empresa"
                defaultValue={
                  job?.customer?.company_name ??
                  pickedCustomer?.company_name ??
                  ""
                }
                placeholder="Opcional, si es cliente empresa"
              />
              <Field
                name="customer_whatsapp"
                label="WhatsApp"
                required
                defaultValue={
                  job?.customer?.whatsapp_phone ??
                  pickedCustomer?.whatsapp_phone ??
                  ""
                }
                placeholder="5216861234567"
                type="tel"
                hint="Con código de país (sin +). Ej: 521 + 10 dígitos."
              />
              <Field
                name="customer_email"
                label="Email"
                type="email"
                defaultValue={
                  job?.customer?.email ?? pickedCustomer?.email ?? ""
                }
                placeholder="opcional@cliente.com"
              />
            </div>
          </Section>

          {/* === SERVICIO === */}
          <Section title="Servicio">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Categoría <span className="text-red-500">*</span>
                </span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="field"
                  required
                >
                  <option value="">Selecciona categoría…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Servicio <span className="text-red-500">*</span>
                </span>
                <select
                  name="service_id"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="field"
                  required
                  disabled={!categoryId}
                >
                  <option value="">
                    {categoryId ? "Selecciona servicio…" : "Primero elige categoría"}
                  </option>
                  {visibleServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Sucursal <span className="text-red-500">*</span>
                </span>
                <select
                  name="branch_id"
                  defaultValue={job?.branch?.id ?? ""}
                  className="field"
                  required
                >
                  <option value="">Selecciona sucursal…</option>
                  {visibleBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.city} — {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                name="cost_mxn"
                label="Costo del servicio (MXN)"
                type="number"
                defaultValue={job?.cost_mxn?.toString() ?? ""}
                placeholder="1500.00"
                min="0"
                step="0.01"
              />

              <div className="sm:col-span-2">
                <Field
                  name="address"
                  label="Dirección donde se presta el servicio"
                  defaultValue={job?.address ?? ""}
                  placeholder="Calle, número, colonia, código postal"
                />
              </div>

              <Field
                name="scheduled_at"
                label="Fecha/hora programada"
                type="datetime-local"
                defaultValue={scheduledLocal}
              />

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Estatus
                </span>
                <select
                  name="status"
                  defaultValue={job?.status ?? "scheduled"}
                  className="field"
                >
                  <option value="scheduled">Pendiente</option>
                  <option value="in_progress">En proceso</option>
                  <option value="completed">
                    Realizado (dispara feedback)
                  </option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
            </div>
          </Section>

          {/* === NOTAS === */}
          <Section title="Notas (opcional)">
            <label className="block">
              <textarea
                name="notes"
                defaultValue={job?.notes ?? initialNotes ?? ""}
                rows={3}
                className="field resize-y"
                maxLength={500}
                placeholder="Cualquier detalle interno sobre este servicio."
              />
            </label>
          </Section>

          {state && !state.ok ? (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending
                ? "Guardando…"
                : isNew
                  ? "Registrar servicio"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </div>
      {children}
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
  min,
  step,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
  min?: string;
  step?: string;
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
        min={min}
        step={step}
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

/** Convierte Date a "YYYY-MM-DDTHH:mm" en zona local del cliente. */
function toDatetimeLocalString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Buscador combobox para seleccionar un cliente existente y prellenar el form.
 * Si ya hay uno seleccionado, muestra una banda de confirmacion con boton para
 * limpiar y volver a buscar (o crear uno nuevo a mano).
 */
function CustomerPicker({
  picked,
  onPick,
  onClear,
}: {
  picked: ServiceJobModalInitialCustomer | null;
  onPick: (c: CustomerSearchResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown si haces click afuera.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const r = await searchCustomers(v);
        setResults(r);
        setOpen(true);
      });
    }, 250);
  }

  function pick(c: CustomerSearchResult) {
    onPick(c);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  if (picked) {
    return (
      <div className="border-b border-slate-200 bg-brand-50/50 px-6 py-3 dark:border-slate-800 dark:bg-brand-500/10">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-brand-800 dark:text-brand-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>
              Cliente seleccionado:{" "}
              <strong>{picked.name ?? picked.whatsapp_phone}</strong>
              {picked.company_name ? ` · ${picked.company_name}` : ""}
              {" "}
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {picked.whatsapp_phone}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Cambiar / nuevo cliente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative border-b border-slate-200 bg-slate-50/40 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/30"
    >
      <label className="block">
        <span className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          ¿Cliente existente? Búscalo aquí para prellenar
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Nombre, empresa, WhatsApp o email…"
          className="field"
        />
        {query.trim().length > 0 && query.trim().length < 2 ? (
          <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
            Escribe al menos 2 caracteres.
          </span>
        ) : null}
      </label>

      {open ? (
        <div className="absolute left-6 right-6 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {searching && results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
              Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
              Sin resultados. Si es cliente nuevo, escribe los datos abajo.
            </div>
          ) : (
            <ul className="py-1">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs transition hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {c.name ?? "(sin nombre)"}
                      {c.company_name ? (
                        <span className="ml-1 text-slate-500 dark:text-slate-400">
                          · {c.company_name}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {c.whatsapp_phone}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Barra de acciones rapidas dentro del modal de edicion. Cambia status y
 * elimina con password. Llama onSuccess para cerrar el modal y refrescar.
 */
function ModalActionBar({
  job,
  onSuccess,
}: {
  job: ServiceJobJoined;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [statusPending, startStatus] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);

  function changeStatus(newStatus: ServiceJobStatus) {
    setStatusError(null);
    startStatus(async () => {
      try {
        const fd = new FormData();
        fd.set("id", job.id);
        fd.set("status", newStatus);
        await changeServiceJobStatus(fd);
        router.refresh();
        onSuccess();
      } catch (e) {
        setStatusError((e as Error).message);
      }
    });
  }

  const canMarkCompleted =
    job.status !== "completed" && job.status !== "cancelled";
  const canReopen = job.status === "cancelled";
  const canCancel =
    job.status !== "cancelled" && job.status !== "completed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/30">
      <div className="flex flex-wrap items-center gap-2">
        {canMarkCompleted ? (
          <button
            type="button"
            onClick={() => changeStatus("completed")}
            disabled={statusPending}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25"
          >
            ✓ Marcar como realizado
          </button>
        ) : null}
        {canReopen ? (
          <button
            type="button"
            onClick={() => changeStatus("scheduled")}
            disabled={statusPending}
            className="btn-ghost text-xs"
          >
            ↻ Reabrir
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            onClick={() => changeStatus("cancelled")}
            disabled={statusPending}
            className="btn-ghost text-xs"
          >
            ✕ Cancelar servicio
          </button>
        ) : null}
        {statusError ? (
          <span className="text-xs text-red-600 dark:text-red-400">
            {statusError}
          </span>
        ) : null}
      </div>

      <DeleteWithPasswordPanel
        jobId={job.id}
        customerName={job.customer?.name ?? "este cliente"}
        onSuccess={() => {
          router.refresh();
          onSuccess();
        }}
      />
    </div>
  );
}

/**
 * Boton "Eliminar servicio" que al click revela un input de password inline.
 * Verifica la password del usuario logeado contra Supabase Auth antes de
 * permitir el delete.
 */
function DeleteWithPasswordPanel({
  jobId,
  customerName,
  onSuccess,
}: {
  jobId: string;
  customerName: string;
  onSuccess: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setConfirming(false);
    setPassword("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await deleteServiceJobWithPassword({
        id: jobId,
        password,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      onSuccess();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        Eliminar servicio
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30 sm:w-auto sm:flex-row sm:items-center">
      <div className="text-xs text-red-700 dark:text-red-300">
        ¿Eliminar el servicio de <strong>{customerName}</strong>? Confirma con
        tu contraseña.
      </div>
      <div className="flex flex-1 items-center gap-2">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") reset();
          }}
          placeholder="Tu contraseña"
          className="field flex-1 text-xs"
          disabled={pending}
        />
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="btn-ghost text-xs"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !password}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Verificando…" : "Confirmar"}
        </button>
      </div>
      {error ? (
        <div className="w-full text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Celda con el estado del feedback para un service_job. Resume el array de
 * feedback_requests por prioridad (en curso > completada > escalada > expirada
 * > cancelada > sin feedback).
 */
function FeedbackStatusCell({
  requests,
}: {
  requests: Array<{ id: string; status: string }>;
}) {
  if (requests.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const open = requests.find((r) =>
    ["pending", "in_progress"].includes(r.status),
  );
  const completed = requests.find((r) => r.status === "completed");
  const escalated = requests.find((r) => r.status === "escalated");
  const expired = requests.find((r) => r.status === "expired");
  const cancelled = requests.find((r) => r.status === "cancelled");

  if (open) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        En curso
      </span>
    );
  }
  if (completed) {
    return <span className="badge-success">Completada</span>;
  }
  if (escalated) {
    return <span className="badge-warning">Escalada</span>;
  }
  if (expired) {
    return <span className="badge-neutral">Expirada</span>;
  }
  if (cancelled) {
    return <span className="badge-neutral">Cancelada</span>;
  }
  return <span className="text-xs text-slate-400">—</span>;
}

/**
 * Header clickeable que cicla entre asc/desc para su columna y mantiene los
 * demas filtros (q, status, branch). Resetea page a 1 al cambiar orden.
 */
function SortableHeader({
  column,
  label,
  current,
}: {
  column: ServicesQueryParams["sort"];
  label: string;
  current: ServicesQueryParams;
}) {
  const isActive = current.sort === column;
  // Default direction al activar la columna por primera vez:
  //   - 'created' default desc (mas reciente arriba)
  //   - texto default asc (alfabetico)
  //   - cost default desc (mayor costo arriba)
  const defaultDir = column === "created" || column === "cost" ? "desc" : "asc";
  const nextDir = isActive
    ? current.dir === "asc"
      ? "desc"
      : "asc"
    : defaultDir;

  const params = new URLSearchParams();
  if (current.q) params.set("q", current.q);
  if (current.status && current.status !== "all") {
    params.set("status", current.status);
  }
  if (current.branch && current.branch !== "all") {
    params.set("branch", current.branch);
  }
  if (column !== "created") params.set("sort", column);
  if (nextDir !== "desc") params.set("dir", nextDir);
  const href = `/services${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <th className="px-4 py-3 font-medium">
      <Link
        href={href}
        className={`group inline-flex items-center gap-1 transition ${
          isActive
            ? "text-slate-900 dark:text-slate-100"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        <span>{label}</span>
        <span
          className={`text-[10px] leading-none transition ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
          }`}
          aria-hidden
        >
          {isActive ? (current.dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </Link>
    </th>
  );
}
