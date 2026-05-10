import { AdminShell } from "@/components/AdminShell";
import { UsersTable, type UserRow } from "@/components/UsersTable";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <AdminShell title="Usuarios">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {error.message}
        </div>
      </AdminShell>
    );
  }

  const users = (data ?? []) as UserRow[];

  return (
    <AdminShell
      title="Usuarios"
      description="Crea, asigna roles y elimina cuentas con acceso al panel."
    >
      <UsersTable users={users} currentUserId={me.id} />
    </AdminShell>
  );
}
