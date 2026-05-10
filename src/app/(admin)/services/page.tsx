import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import {
  ServicesPanel,
  type ServiceJobJoined,
  type ServicesQueryParams,
} from "@/components/ServicesPanel";
import { ServicesFilters } from "@/components/ServicesFilters";
import { NewServiceButton } from "@/components/NewServiceButton";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  BranchRow,
  EmployeeRow,
  ServiceCategoryRow,
  ServiceJobStatus,
  ServiceRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SortKey =
  | "created"
  | "customer"
  | "service"
  | "branch"
  | "cost"
  | "status";
type SortDir = "asc" | "desc";

const VALID_SORTS: SortKey[] = [
  "created",
  "customer",
  "service",
  "branch",
  "cost",
  "status",
];

interface SearchParams {
  status?: string;
  branch?: string;
  page?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const search = (sp.q ?? "").trim();
  const sort: SortKey = VALID_SORTS.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : "created";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

  const sb = supabaseServer();

  // -------------------------------------------------------------------------
  // Si hay search, primero resolvemos IDs candidatos en customers / branches
  // / services en paralelo y construimos un OR filter sobre service_jobs.
  // -------------------------------------------------------------------------
  let searchOrFilter: string | null = null;
  if (search) {
    const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;

    const [custRes, brRes, svcRes] = await Promise.all([
      sb
        .from("customers")
        .select("id")
        .or(
          [
            `name.ilike.${pattern}`,
            `company_name.ilike.${pattern}`,
            `whatsapp_phone.ilike.${pattern}`,
            `email.ilike.${pattern}`,
          ].join(","),
        ),
      sb
        .from("branches")
        .select("id")
        .or([`name.ilike.${pattern}`, `city.ilike.${pattern}`].join(",")),
      sb
        .from("services")
        .select("id")
        .or([`name.ilike.${pattern}`, `code.ilike.${pattern}`].join(",")),
    ]);

    const customerIds = (custRes.data ?? []).map((r) => r.id);
    const branchIds = (brRes.data ?? []).map((r) => r.id);
    const serviceIds = (svcRes.data ?? []).map((r) => r.id);

    const orParts: string[] = [];
    if (customerIds.length > 0) {
      orParts.push(`customer_id.in.(${customerIds.join(",")})`);
    }
    if (branchIds.length > 0) {
      orParts.push(`branch_id.in.(${branchIds.join(",")})`);
    }
    if (serviceIds.length > 0) {
      orParts.push(`service_id.in.(${serviceIds.join(",")})`);
    }

    // Si nada matcheo, forzamos un filtro que devuelve 0 filas.
    searchOrFilter =
      orParts.length > 0
        ? orParts.join(",")
        : `id.eq.00000000-0000-0000-0000-000000000000`;
  }

  const [branchesRes, categoriesRes, servicesRes, employeesRes, jobsRes] = await Promise.all([
    sb.from("branches").select("*").order("city"),
    sb.from("service_categories").select("*").order("slug"),
    sb.from("services").select("*").order("code"),
    sb
      .from("employees")
      .select("*")
      .eq("active", true)
      .order("full_name"),
    (() => {
      let q = sb
        .from("service_jobs")
        .select(
          `
          id, scheduled_at, completed_at, status, notes, address, cost_mxn, created_at,
          assigned_employee_id, pdf_sent_at,
          customer:customers!service_jobs_customer_id_fkey(id, name, company_name, whatsapp_phone, email),
          branch:branches!service_jobs_branch_id_fkey(id, name, city),
          service:services!service_jobs_service_id_fkey(id, name, code, category_id),
          assigned_employee:employees!service_jobs_assigned_employee_id_fkey(id, full_name, position),
          feedback_requests(id, status)
        `,
          { count: "exact" },
        );

      // Filtros antes que sort/range.
      if (sp.status && sp.status !== "all") {
        q = q.eq("status", sp.status as ServiceJobStatus);
      }
      if (sp.branch && sp.branch !== "all") {
        q = q.eq("branch_id", sp.branch);
      }
      if (searchOrFilter) {
        q = q.or(searchOrFilter);
      }

      // Sort segun el SortKey (joined columns usan referencedTable).
      const ascending = dir === "asc";
      switch (sort) {
        case "customer":
          q = q.order("name", { referencedTable: "customer", ascending });
          break;
        case "service":
          q = q.order("code", { referencedTable: "service", ascending });
          break;
        case "branch":
          q = q.order("city", { referencedTable: "branch", ascending });
          break;
        case "cost":
          q = q.order("cost_mxn", { ascending, nullsFirst: false });
          break;
        case "status":
          q = q.order("status", { ascending });
          break;
        case "created":
        default:
          q = q.order("created_at", { ascending });
          break;
      }
      // Tiebreaker estable.
      q = q.order("id", { ascending: true });

      return q.range(offset, offset + PAGE_SIZE - 1);
    })(),
  ]);

  const branches = (branchesRes.data ?? []) as BranchRow[];
  const categories = (categoriesRes.data ?? []) as ServiceCategoryRow[];
  const services = (servicesRes.data ?? []) as ServiceRow[];
  const employees = (employeesRes.data ?? []) as EmployeeRow[];
  const jobs = (jobsRes.data ?? []) as unknown as ServiceJobJoined[];
  const totalCount = jobsRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const branchesActiveForFilter = branches.filter((b) => b.active);

  const currentParams: ServicesQueryParams = {
    q: search,
    status: sp.status ?? "",
    branch: sp.branch ?? "",
    sort,
    dir,
  };

  function buildHref(overrides: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged: SearchParams = { ...sp, ...overrides };
    if (merged.q) params.set("q", merged.q);
    if (merged.status && merged.status !== "all") {
      params.set("status", merged.status);
    }
    if (merged.branch && merged.branch !== "all") {
      params.set("branch", merged.branch);
    }
    if (merged.sort && merged.sort !== "created") params.set("sort", merged.sort);
    if (merged.dir && merged.dir !== "desc") params.set("dir", merged.dir);
    if (merged.page && merged.page !== "1") params.set("page", merged.page);
    const qs = params.toString();
    return qs ? `/services?${qs}` : "/services";
  }

  // Cambiar filtro = resetear page.
  function filterHref(overrides: Partial<SearchParams>): string {
    return buildHref({ ...overrides, page: undefined });
  }

  return (
    <AdminShell
      title="Servicios"
      actions={
        <NewServiceButton
          branches={branches}
          categories={categories}
          services={services}
        />
      }
    >
      {/* Buscador + filtros: stack vertical en mobile, una fila en lg+ */}
      <div className="card mb-4 flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
        <form
          action="/services"
          method="get"
          className="flex w-full min-w-0 items-center gap-2 lg:flex-1"
        >
          {sp.status && sp.status !== "all" ? (
            <input type="hidden" name="status" value={sp.status} />
          ) : null}
          {sp.branch && sp.branch !== "all" ? (
            <input type="hidden" name="branch" value={sp.branch} />
          ) : null}
          {sp.sort && sp.sort !== "created" ? (
            <input type="hidden" name="sort" value={sp.sort} />
          ) : null}
          {sp.dir && sp.dir !== "desc" ? (
            <input type="hidden" name="dir" value={sp.dir} />
          ) : null}

          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Buscar cliente, empresa, WhatsApp, sucursal o servicio…"
              className="field pl-9"
            />
          </div>

          <button type="submit" className="btn-primary text-sm">
            Buscar
          </button>
          {search ? (
            <Link href={filterHref({ q: "" })} className="btn-ghost text-sm">
              Limpiar
            </Link>
          ) : null}
        </form>

        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
          <ServicesFilters
            status={sp.status ?? ""}
            branch={sp.branch ?? ""}
            branches={branchesActiveForFilter}
          />
        </div>
      </div>

      {jobsRes.error ? (
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {jobsRes.error.message}
        </div>
      ) : null}

      <ServicesPanel
        jobs={jobs}
        branches={branches}
        categories={categories}
        services={services}
        employees={employees}
        currentParams={currentParams}
      />

      <TableFooter
        totalCount={totalCount}
        currentPage={page}
        totalPages={totalPages}
        firstShown={totalCount === 0 ? 0 : offset + 1}
        lastShown={offset + jobs.length}
        searchTerm={search}
        hrefForPage={(p) => buildHref({ page: p > 1 ? String(p) : undefined })}
      />
    </AdminShell>
  );
}

/**
 * Footer de la tabla: contador a la izquierda, paginacion a la derecha.
 * Siempre visible (incluso con 1 sola pagina). Si totalPages > 1, agrega
 * los controles de navegacion.
 */
function TableFooter({
  totalCount,
  currentPage,
  totalPages,
  firstShown,
  lastShown,
  searchTerm,
  hrefForPage,
}: {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  firstShown: number;
  lastShown: number;
  searchTerm: string;
  hrefForPage: (p: number) => string;
}) {
  const pageNumbers = computeVisiblePages(currentPage, totalPages);

  let leftText: string;
  if (totalCount === 0) {
    leftText = searchTerm
      ? `Sin resultados para "${searchTerm}".`
      : "Sin servicios registrados.";
  } else {
    const noun = totalCount === 1 ? "servicio" : "servicios";
    const filtered = searchTerm ? ` para "${searchTerm}"` : "";
    leftText =
      totalPages > 1
        ? `${firstShown}–${lastShown} de ${totalCount} ${noun}${filtered} · Página ${currentPage} de ${totalPages}`
        : `${totalCount} ${noun}${filtered} · Página 1 de 1`;
  }

  return (
    <nav
      aria-label="Pie de tabla"
      className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400"
    >
      <span>{leftText}</span>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <PageLink
            href={hrefForPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            aria-label="Página anterior"
          >
            ‹
          </PageLink>

          {pageNumbers.map((n, i) =>
            n === "ellipsis" ? (
              <span
                key={`e${i}`}
                className="px-2 text-xs text-slate-400"
                aria-hidden
              >
                …
              </span>
            ) : (
              <PageLink
                key={n}
                href={hrefForPage(n)}
                active={n === currentPage}
              >
                {n}
              </PageLink>
            ),
          )}

          <PageLink
            href={hrefForPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            aria-label="Página siguiente"
          >
            ›
          </PageLink>
        </div>
      ) : null}
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...rest
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const className = `inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition ${
    active
      ? "bg-brand-600 text-white"
      : disabled
        ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
  }`;

  if (disabled) {
    return (
      <span className={className} aria-disabled {...rest}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

function computeVisiblePages(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: Array<number | "ellipsis"> = [1];
  if (current > 3) result.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) result.push(i);
  if (current < total - 2) result.push("ellipsis");
  result.push(total);
  return result;
}
