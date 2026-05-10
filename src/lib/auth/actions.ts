"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { supabaseServerAuth } from "@/lib/supabase/server-auth";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const emailSchema = z.string().trim().email("Email inválido");
const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres");

// --- Login ------------------------------------------------------------------

export async function signIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/services");

  if (!emailSchema.safeParse(email).success) {
    return { ok: false, error: "Email inválido" };
  }
  if (!password) {
    return { ok: false, error: "Ingresa tu contraseña" };
  }

  const sb = await supabaseServerAuth();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      return { ok: false, error: "Email o contraseña incorrectos." };
    }
    if (/email not confirmed/i.test(error.message)) {
      return { ok: false, error: "Revisa tu correo y confirma tu cuenta antes de iniciar sesión." };
    }
    return { ok: false, error: error.message };
  }

  redirect(next.startsWith("/") ? next : "/services");
}

// --- Logout -----------------------------------------------------------------

export async function signOut(): Promise<void> {
  const sb = await supabaseServerAuth();
  await sb.auth.signOut();
  redirect("/login");
}

// --- Forgot password ---------------------------------------------------------

export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  if (!emailSchema.safeParse(email).success) {
    return { ok: false, error: "Email inválido" };
  }

  const h = await headers();
  const origin =
    h.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const sb = await supabaseServerAuth();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    message: "Si el correo existe, te llegará un enlace para restablecer tu contraseña.",
  };
}

// --- Reset password (después de hacer click en el link del correo) ----------

export async function updatePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!passwordSchema.safeParse(password).success) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Las contraseñas no coinciden." };
  }

  const sb = await supabaseServerAuth();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Sesión inválida. Solicita un nuevo enlace de restablecimiento.",
    };
  }

  const { error } = await sb.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  redirect("/services");
}

// --- Crear usuario (solo admin) ---------------------------------------------

const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "user"]),
});

export async function createUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name") || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const sbAdmin = supabaseServer();

  // Crea el usuario con email_confirm = true para que pueda loguearse al instante.
  const { data: created, error: createErr } = await sbAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: parsed.data.full_name
      ? { full_name: parsed.data.full_name }
      : undefined,
  });
  if (createErr) {
    if (/already.*registered|already exists/i.test(createErr.message)) {
      return { ok: false, error: "Ya existe un usuario con ese email." };
    }
    return { ok: false, error: createErr.message };
  }

  // Set role + full_name en profiles (el trigger ya lo creo).
  const { error: profileErr } = await sbAdmin
    .from("profiles")
    .update({
      role: parsed.data.role,
      full_name: parsed.data.full_name ?? null,
    })
    .eq("id", created.user.id);
  if (profileErr) {
    return {
      ok: false,
      error: `Usuario creado pero falló al asignar rol: ${profileErr.message}`,
    };
  }

  revalidatePath("/users");
  return { ok: true, message: `Usuario ${parsed.data.email} creado.` };
}

// --- Cambiar rol de usuario (solo admin) ------------------------------------

export async function setUserRole(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!id || (role !== "admin" && role !== "user")) return;
  const sbAdmin = supabaseServer();
  await sbAdmin.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/users");
}

// --- Eliminar usuario (solo admin) ------------------------------------------

export async function deleteUser(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === me.id) return; // No puedes eliminarte a ti mismo
  const sbAdmin = supabaseServer();
  await sbAdmin.auth.admin.deleteUser(id);
  revalidatePath("/users");
}
