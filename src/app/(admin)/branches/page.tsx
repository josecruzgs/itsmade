import { AdminShell } from "@/components/AdminShell";
import { BranchesPanel } from "@/components/BranchesPanel";
import { supabaseServer } from "@/lib/supabase/server";
import type { BranchRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("branches")
    .select("*")
    .order("city", { ascending: true });

  if (error) {
    return (
      <AdminShell title="Sucursales">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {error.message}
        </div>
      </AdminShell>
    );
  }

  const branches = (data ?? []) as BranchRow[];

  return (
    <AdminShell
      title="Sucursales"
      description="Crea, edita y desactiva las sucursales donde se ofrecen los servicios."
    >
      <BranchesPanel branches={branches} />
    </AdminShell>
  );
}
