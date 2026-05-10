import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Cliente Supabase con service role. Solo debe usarse desde codigo server-side
 * (route handlers, server components, server actions). Bypass de RLS.
 */
export function supabaseServer(): SupabaseClient {
  if (cached) return cached;
  const e = env();
  cached = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-itsmade": "server" } },
  });
  return cached;
}
