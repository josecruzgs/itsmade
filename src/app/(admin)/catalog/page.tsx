import { AdminShell } from "@/components/AdminShell";
import { CatalogPanel } from "@/components/CatalogPanel";
import { supabaseServer } from "@/lib/supabase/server";
import type { ServiceCategoryRow, ServiceRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const sb = supabaseServer();
  const [catRes, svcRes] = await Promise.all([
    sb.from("service_categories").select("*").order("slug"),
    sb
      .from("services")
      .select("*, category:service_categories!services_category_id_fkey(slug)")
      .order("code"),
  ]);

  if (catRes.error || svcRes.error) {
    return (
      <AdminShell title="Catálogo">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {catRes.error?.message ?? svcRes.error?.message}
        </div>
      </AdminShell>
    );
  }

  const categories = (catRes.data ?? []) as ServiceCategoryRow[];
  const servicesRaw = (svcRes.data ?? []) as Array<
    ServiceRow & { category: { slug: string } | null }
  >;
  const services = servicesRaw.map((s) => ({
    ...s,
    category_slug: s.category?.slug,
  }));

  return (
    <AdminShell
      title="Catálogo"
      description="Servicios y categorías que se ofrecen desde itsMade."
    >
      <CatalogPanel categories={categories} services={services} />
    </AdminShell>
  );
}
