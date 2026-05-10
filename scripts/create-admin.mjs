// Crea un usuario admin via Supabase Auth Admin API.
// Uso:
//   node scripts/create-admin.mjs <email> <password> [full_name]
//
// Ejemplo:
//   node scripts/create-admin.mjs jose@itsmade.com.mx "Alexa!123" "Jose Cruz"
//
// Requisitos:
//   - .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
//   - Las migraciones 0001+0002+0003 aplicadas

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) throw new Error(`No existe: ${path}`);
  const content = readFileSync(path, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}

const [, , email, password, fullName] = process.argv;
if (!email || !password) {
  console.error(
    "Uso: node scripts/create-admin.mjs <email> <password> [full_name]",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(emailToFind) {
  let page = 1;
  while (page < 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === emailToFind.toLowerCase(),
    );
    if (found) return found;
    if (data.users.length < 200) return null;
    page++;
  }
  return null;
}

async function selectProfileWithRetry(userId, attempts = 6) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();
    if (!error) return { data };
    lastErr = error;
    // PGRST205 = table not in schema cache. Reintenta tras pausa porque
    // PostgREST refresca el cache de forma eventualmente consistente.
    if (error.code === "PGRST205") {
      const wait = 1500 + i * 1500;
      console.log(
        `  Schema cache stale (intento ${i + 1}/${attempts}). Esperando ${wait}ms...`,
      );
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return { error };
  }
  return { error: lastErr };
}

async function ensureProfileAdmin(userId, emailValue, fullNameValue) {
  const { data: existing, error: selErr } = await selectProfileWithRetry(userId);
  if (selErr) {
    if (selErr.code === "PGRST205") {
      console.error("");
      console.error(
        "PostgREST no logro refrescar el schema cache despues de varios intentos.",
      );
      console.error("Intenta cualquiera de estas:");
      console.error("  1. Espera 1-2 minutos y vuelve a correr este script.");
      console.error(
        "  2. En Supabase Dashboard -> Settings -> API -> 'Reload schema cache'.",
      );
      console.error("  3. En SQL Editor: NOTIFY pgrst, 'reload schema';");
      process.exit(2);
    }
    throw selErr;
  }

  if (!existing) {
    console.log("Insertando profile faltante con rol admin...");
    const { error: insErr } = await supabase.from("profiles").insert({
      id: userId,
      email: emailValue,
      full_name: fullNameValue ?? null,
      role: "admin",
    });
    if (insErr) throw insErr;
    return "inserted";
  }

  if (existing.role === "admin") {
    console.log("Ya es admin. Actualizando metadatos por si cambiaron...");
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ email: emailValue, full_name: fullNameValue ?? null })
      .eq("id", userId);
    if (updErr) throw updErr;
    return "noop";
  }

  console.log(`Promoviendo a admin (rol actual: ${existing.role})...`);
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ role: "admin", full_name: fullNameValue ?? null })
    .eq("id", userId);
  if (updErr) throw updErr;
  return "promoted";
}

async function main() {
  console.log(`Procesando usuario: ${email}...`);

  const existingAuth = await findAuthUserByEmail(email);

  let userId;
  if (existingAuth) {
    console.log(`Ya existe en auth.users (id: ${existingAuth.id}).`);
    userId = existingAuth.id;
    if (password) {
      console.log("Actualizando contrasena por si era distinta...");
      const { error: pwErr } = await supabase.auth.admin.updateUserById(
        existingAuth.id,
        { password, email_confirm: true },
      );
      if (pwErr && !/same as current/i.test(pwErr.message)) {
        console.warn(`  (no se pudo actualizar contrasena: ${pwErr.message})`);
      }
    }
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (createErr) throw createErr;
    userId = created.user.id;
    console.log(`Usuario creado en auth.users (id: ${userId}).`);
  }

  await ensureProfileAdmin(userId, email, fullName);

  console.log("");
  console.log("OK. Listo para iniciar sesion.");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Rol:      admin`);
  console.log(`  URL:      http://localhost:3000/login`);
}

main().catch((e) => {
  console.error("\nError:", e.message ?? e);
  process.exit(1);
});
