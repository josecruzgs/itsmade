import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { supabaseServerAuth } from "@/lib/supabase/server-auth";

/**
 * Maneja los enlaces que Supabase envia por email (recovery, confirm, etc.).
 * Recibe ?token_hash=...&type=...&next=/ruta y verifica el OTP.
 * Despues de verificar, la cookie de sesion queda lista y el usuario se redirige.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/services";

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const supabase = await supabaseServerAuth();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
