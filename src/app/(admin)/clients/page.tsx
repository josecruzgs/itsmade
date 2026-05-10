import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { ClientsPanel, type ClientRow } from "@/components/ClientsPanel";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  BranchRow,
  ServiceCategoryRow,
  ServiceRow,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const search = (sp.q ?? "").trim();

  const sb = supabaseServer();

  let customersQuery = sb
    .from("customers")
    .select(
      `
      id, whatsapp_phone, name, email, company_name, created_at,
      service_jobs(id, created_at)
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (search) {
    const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
    customersQuery = customersQuery.or(
      [
        `name.ilike.${pattern}`,
        `company_name.ilike.${pattern}`,
        `whatsapp_phone.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ].join(","),
    );
  }

  const [customersRes, branchesRes, categoriesRes, servicesRes] =
    await Promise.all([
      customersQuery,
      sb.from("branches").select("*").order("city"),
      sb.from("service_categories").select("*").order("slug"),
      sb.from("services").select("*").order("code"),
    ]);

  const branches = (branchesRes.data ?? []) as BranchRow[];
  const categories = (categoriesRes.data ?? []) as ServiceCategoryRow[];
  const services = (servicesRes.data ?? []) as ServiceRow[];

  type CustomerWithJobs = {
    id: string;
    whatsapp_phone: string;
    name: string | null;
    email: string | null;
    company_name: string | null;
    created_at: string;
    service_jobs: Array<{ id: string; created_at: string }> | null;
  };
  const raw = (customersRes.data ?? []) as unknown as CustomerWithJobs[];
  const totalCount = customersRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const clients: ClientRow[] = raw.map((c) => {
    const jobs = c.service_jobs ?? [];
    const last = jobs.reduce<string | null>((latest, j) => {
      if (!latest) return j.created_at;
      return new Date(j.created_at).getTime() > new Date(latest).getTime()
        ? j.created_at
        : latest;
    }, null);
    return {
      id: c.id,
      whatsapp_phone: c.whatsapp_phone,
      name: c.name,
      email: c.email,
      company_name: c.company_name,
      created_at: c.created_at,
      total_services: jobs.length,
      last_service_at: last,
    };
  });

  function buildHref(overrides: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged: SearchParams = { ...sp, ...overrides };
    if (merged.q) params.set("q", merged.q);
    if (merged.page && merged.page !== "1") params.set("page", merged.page);
    const qs = params.toString();
    return qs ? `/clients?${qs}` : "/clients";
  }

  const description =
    totalCount === 0 && !search
      ? "Aún no hay clientes. Se crean automáticamente al registrar el primer servicio."
      : `${totalCount} ${totalCount === 1 ? "cliente" : "clientes"}${search ? ` para "${search}"` : ""} · página ${page} de ${totalPages}.`;

  return (
    <AdminShell title="Clientes" description={description}>
      {/* Search bar */}
      <form
        action="/clients"
        method="get"
        className="card mb-4 flex flex-wrap items-center gap-2 p-3"
      >
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
            placeholder="Buscar por nombre, empresa, WhatsApp o email…"
            className="field pl-9"
          />
        </div>
        <button type="submit" className="btn-primary text-sm">
          Buscar
        </button>
        {search ? (
          <Link href={buildHref({ q: "", page: undefined })} className="btn-ghost text-sm">
            Limpiar
          </Link>
        ) : null}
      </form>

      {customersRes.error ? (
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {customersRes.error.message}
        </div>
      ) : null}

      <ClientsPanel
        clients={clients}
        branches={branches}
        categories={categories}
        services={services}
      />

      {totalCount > PAGE_SIZE ? (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          firstShown={offset + 1}
          lastShown={offset + clients.length}
          hrefForPage={(p) => buildHref({ page: p > 1 ? String(p) : undefined })}
        />
      ) : null}
    </AdminShell>
  );
}

function Pagination({
  currentPage,
  totalPages,
  totalCount,
  firstShown,
  lastShown,
  hrefForPage,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  firstShown: number;
  lastShown: number;
  hrefForPage: (p: number) => string;
}) {
  const pageNumbers = computeVisiblePages(currentPage, totalPages);

  return (
    <nav
      aria-label="Paginación"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Mostrando{" "}
        <strong className="text-slate-700 dark:text-slate-200">
          {firstShown}–{lastShown}
        </strong>{" "}
        de{" "}
        <strong className="text-slate-700 dark:text-slate-200">{totalCount}</strong>
      </span>

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
