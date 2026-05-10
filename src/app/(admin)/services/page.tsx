import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { RequestFeedbackButton } from "@/components/RequestFeedbackButton";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  BranchRow,
  CustomerRow,
  ServiceJobStatus,
  ServiceRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface ServiceJobRowJoined {
  id: string;
  scheduled_at: string | null;
  completed_at: string | null;
  status: ServiceJobStatus;
  notes: string | null;
  created_at: string;
  customer: Pick<CustomerRow, "id" | "name" | "whatsapp_phone"> | null;
  branch: Pick<BranchRow, "id" | "name" | "city"> | null;
  service: Pick<ServiceRow, "id" | "name" | "code"> | null;
  feedback_requests: Array<{ id: string; status: string }>;
}

const statusBadge: Record<ServiceJobStatus, string> = {
  scheduled: "badge-neutral",
  in_progress: "badge-warning",
  completed: "badge-success",
  cancelled: "badge-neutral",
};

const STATUS_LABEL: Record<ServiceJobStatus, string> = {
  scheduled: "Agendado",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

interface SearchParams {
  status?: string;
  branch?: string;
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sb = supabaseServer();

  const [branchesRes, jobsRes] = await Promise.all([
    sb.from("branches").select("id, name, city").eq("active", true).order("city"),
    (() => {
      let q = sb
        .from("service_jobs")
        .select(
          `
          id, scheduled_at, completed_at, status, notes, created_at,
          customer:customers!service_jobs_customer_id_fkey(id, name, whatsapp_phone),
          branch:branches!service_jobs_branch_id_fkey(id, name, city),
          service:services!service_jobs_service_id_fkey(id, name, code),
          feedback_requests(id, status)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (sp.status && sp.status !== "all") {
        q = q.eq("status", sp.status as ServiceJobStatus);
      }
      if (sp.branch && sp.branch !== "all") {
        q = q.eq("branch_id", sp.branch);
      }
      return q;
    })(),
  ]);

  const branches = (branchesRes.data ?? []) as Array<Pick<BranchRow, "id" | "name" | "city">>;
  const jobs = (jobsRes.data ?? []) as unknown as ServiceJobRowJoined[];

  return (
    <AdminShell
      title="Servicios"
      description={`${jobs.length} órdenes de servicio recientes.`}
    >
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <FilterPill
          label="Todos"
          href="/services"
          active={!sp.status || sp.status === "all"}
        />
        {(["scheduled", "in_progress", "completed", "cancelled"] as ServiceJobStatus[]).map(
          (s) => (
            <FilterPill
              key={s}
              label={STATUS_LABEL[s]}
              href={`/services?status=${s}${sp.branch ? `&branch=${sp.branch}` : ""}`}
              active={sp.status === s}
            />
          ),
        )}
        <span className="ml-2 text-sm text-slate-400">|</span>
        <FilterPill
          label="Todas las sucursales"
          href={`/services${sp.status ? `?status=${sp.status}` : ""}`}
          active={!sp.branch || sp.branch === "all"}
        />
        {branches.map((b) => (
          <FilterPill
            key={b.id}
            label={b.city}
            href={`/services?${new URLSearchParams({
              ...(sp.status ? { status: sp.status } : {}),
              branch: b.id,
            }).toString()}`}
            active={sp.branch === b.id}
          />
        ))}
      </div>

      {jobsRes.error ? (
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {jobsRes.error.message}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Completado</th>
                <th className="px-4 py-3 text-right font-medium">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.map((j) => {
                const openReq = j.feedback_requests?.find((r) =>
                  ["pending", "in_progress"].includes(r.status),
                );
                const completedReq = j.feedback_requests?.find(
                  (r) => r.status === "completed",
                );
                return (
                  <tr
                    key={j.id}
                    className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {j.customer?.name ?? "—"}
                      </div>
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {j.customer?.whatsapp_phone ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 dark:text-slate-100">
                        {j.service?.name ?? "—"}
                      </div>
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {j.service?.code ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {j.branch?.city ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadge[j.status]}>
                        {STATUS_LABEL[j.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {j.completed_at
                        ? new Date(j.completed_at).toLocaleString("es-MX")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {j.status === "completed" ? (
                        <RequestFeedbackButton
                          serviceJobId={j.id}
                          hasOpenRequest={Boolean(openReq)}
                          hasCompletedRequest={Boolean(completedReq) && !openReq}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No hay servicios con esos filtros.
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

function FilterPill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </Link>
  );
}
