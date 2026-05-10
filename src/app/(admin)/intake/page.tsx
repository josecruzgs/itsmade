import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { IntakeConvertButton } from "@/components/IntakeConvertButton";
import { supabaseServer } from "@/lib/supabase/server";
import {
  assignIntakeToMe,
  updateIntakeNotes,
  updateIntakeStatus,
} from "@/lib/intake/actions";
import type {
  BranchRow,
  CustomerRow,
  IntakeRequestStatus,
  ProfileRow,
  ServiceCategoryRow,
  ServiceRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface IntakeRowJoined {
  id: string;
  status: IntakeRequestStatus;
  requested_name: string;
  requested_phone: string;
  raw_request_description: string | null;
  notes: string | null;
  created_at: string;
  conversation_id: string;
  service_job_id: string | null;
  customer: Pick<CustomerRow, "id" | "name" | "whatsapp_phone"> | null;
  assigned_to: Pick<ProfileRow, "id" | "full_name" | "email"> | null;
}

const statusBadge: Record<IntakeRequestStatus, string> = {
  pending_review: "badge-warning",
  in_review: "badge-brand",
  converted: "badge-success",
  dismissed: "badge-neutral",
};

const statusLabel: Record<IntakeRequestStatus, string> = {
  pending_review: "Pendiente",
  in_review: "En revision",
  converted: "Convertido",
  dismissed: "Descartado",
};

export default async function IntakePage() {
  const sb = supabaseServer();

  // Cargamos en paralelo: intakes + catalogos para que el modal de conversion
  // (que reusa ServiceJobModal) tenga branches/categories/services.
  const [intakesRes, branchesRes, categoriesRes, servicesRes] = await Promise.all([
    sb
      .from("service_intake_requests")
      .select(
        `
      id, status, requested_name, requested_phone, raw_request_description,
      notes, created_at, conversation_id, service_job_id,
      customer:customers!service_intake_requests_customer_id_fkey(id, name, whatsapp_phone),
      assigned_to:profiles!service_intake_requests_assigned_to_profile_id_fkey(id, full_name, email)
    `,
      )
      .order("created_at", { ascending: false })
      .limit(200),
    sb.from("branches").select("*").order("city"),
    sb.from("service_categories").select("*").order("name"),
    sb.from("services").select("*").order("name"),
  ]);

  if (intakesRes.error) {
    return (
      <AdminShell title="Solicitudes de servicio">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {intakesRes.error.message}
        </div>
      </AdminShell>
    );
  }

  const rows = (intakesRes.data ?? []) as unknown as IntakeRowJoined[];
  const branches = (branchesRes.data ?? []) as BranchRow[];
  const categories = (categoriesRes.data ?? []) as ServiceCategoryRow[];
  const services = (servicesRes.data ?? []) as ServiceRow[];

  const summary = {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending_review").length,
    inReview: rows.filter((r) => r.status === "in_review").length,
    converted: rows.filter((r) => r.status === "converted").length,
    dismissed: rows.filter((r) => r.status === "dismissed").length,
  };

  return (
    <AdminShell
      title="Solicitudes de servicio"
      description={`${summary.total} solicitudes recolectadas por el bot. Pendientes de revisar: ${summary.pending}.`}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Pendientes" value={summary.pending} tone="warning" />
        <SummaryCard label="En revision" value={summary.inReview} tone="brand" />
        <SummaryCard label="Convertidas" value={summary.converted} tone="success" />
        <SummaryCard label="Descartadas" value={summary.dismissed} tone="neutral" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Solicitante</th>
                <th className="px-4 py-3 font-medium">Necesidad</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Asignado</th>
                <th className="px-4 py-3 font-medium">Recibida</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <IntakeRow
                  key={r.id}
                  row={r}
                  branches={branches}
                  categories={categories}
                  services={services}
                />
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Aun no hay solicitudes. Cuando un cliente pida un servicio
                    por WhatsApp, el agente lo registrara aqui.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function IntakeRow({
  row,
  branches,
  categories,
  services,
}: {
  row: IntakeRowJoined;
  branches: BranchRow[];
  categories: ServiceCategoryRow[];
  services: ServiceRow[];
}) {
  const customerHasNameMismatch =
    row.customer?.name && row.customer.name.trim() !== row.requested_name.trim();

  return (
    <tr className="align-top transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {row.requested_name}
        </div>
        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {row.requested_phone}
        </div>
        {customerHasNameMismatch ? (
          <div className="mt-1 text-xs italic text-amber-700 dark:text-amber-400">
            En base como: {row.customer?.name}
          </div>
        ) : null}
      </td>

      <td className="max-w-md px-4 py-3 text-slate-700 dark:text-slate-300">
        {row.raw_request_description ?? (
          <span className="italic text-slate-400">(sin descripcion)</span>
        )}
        {row.notes ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Notas internas
            </summary>
            <div className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
              {row.notes}
            </div>
          </details>
        ) : null}
      </td>

      <td className="px-4 py-3">
        <span className={statusBadge[row.status]}>{statusLabel[row.status]}</span>
        {row.service_job_id ? (
          <Link
            href="/services"
            className="mt-1 block text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            Ver servicio →
          </Link>
        ) : null}
      </td>

      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
        {row.assigned_to ? (
          row.assigned_to.full_name ?? row.assigned_to.email
        ) : (
          <span className="italic text-slate-400">—</span>
        )}
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        {new Date(row.created_at).toLocaleString("es-MX", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Link
            href={`/conversations#conv-${row.conversation_id}`}
            className="btn-ghost text-xs"
          >
            Ver chat
          </Link>

          {row.status === "pending_review" ? (
            <form action={assignIntakeToMe}>
              <input type="hidden" name="id" value={row.id} />
              <button type="submit" className="btn-ghost w-full text-xs">
                Tomar
              </button>
            </form>
          ) : null}

          {row.status === "pending_review" || row.status === "in_review" ? (
            <>
              <IntakeConvertButton
                seed={{
                  intakeId: row.id,
                  customer: {
                    id: row.customer?.id,
                    name: row.requested_name,
                    company_name: null,
                    whatsapp_phone:
                      row.customer?.whatsapp_phone ?? row.requested_phone,
                    email: null,
                  },
                  description: row.raw_request_description,
                }}
                branches={branches}
                categories={categories}
                services={services}
              />
              <form action={updateIntakeStatus}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="status" value="dismissed" />
                <button type="submit" className="btn-ghost w-full text-xs text-red-600 dark:text-red-400">
                  Descartar
                </button>
              </form>
            </>
          ) : null}

          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              {row.notes ? "Editar notas" : "Agregar notas"}
            </summary>
            <form action={updateIntakeNotes} className="mt-1.5 flex flex-col gap-1.5">
              <input type="hidden" name="id" value={row.id} />
              <textarea
                name="notes"
                rows={2}
                defaultValue={row.notes ?? ""}
                placeholder="Notas internas (no las ve el cliente)"
                className="field text-xs"
              />
              <button type="submit" className="btn-ghost text-xs">
                Guardar
              </button>
            </form>
          </details>
        </div>
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "brand" | "neutral";
}) {
  const toneCls: Record<typeof tone, string> = {
    success: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    brand: "text-brand-700 dark:text-brand-300",
    neutral: "text-slate-700 dark:text-slate-300",
  };
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls[tone]}`}>
        {value}
      </div>
    </div>
  );
}
