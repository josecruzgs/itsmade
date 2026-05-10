import { AdminShell } from "@/components/AdminShell";
import { EmployeesPanel } from "@/components/EmployeesPanel";
import { supabaseServer } from "@/lib/supabase/server";
import type { EmployeeRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("employees")
    .select("*")
    .order("active", { ascending: false })
    .order("full_name");

  if (error) {
    return (
      <AdminShell title="Empleados">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {error.message}
        </div>
      </AdminShell>
    );
  }

  const employees = (data ?? []) as EmployeeRow[];

  return (
    <AdminShell
      title="Empleados"
      description="Equipo de itsMade que ejecuta los servicios. Aqui asignas a quien le mandas la hoja PDF de cada servicio."
    >
      <EmployeesPanel employees={employees} />
    </AdminShell>
  );
}
