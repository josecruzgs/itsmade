import { redirect } from "next/navigation";
import { supabaseServerAuth } from "@/lib/supabase/server-auth";
import { supabaseServer } from "@/lib/supabase/server";

export type UserRole = "admin" | "user";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
}

/**
 * Devuelve el usuario actual o null si no hay sesion.
 * Usa service_role para leer el profile y evitar problemas de RLS recien aplicada.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const sb = await supabaseServerAuth();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const sbAdmin = supabaseServer();
  const { data: profile } = await sbAdmin
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    role: (profile?.role as UserRole) ?? "user",
    fullName: profile?.full_name ?? null,
  };
}

/** Redirige a /login si no hay sesion. */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirige a /services si el usuario no es admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "admin") redirect("/services?error=admin_only");
  return user;
}
