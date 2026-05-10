import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Rutas que NO requieren sesion. El resto si.
const PUBLIC_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/login(\/|$)/,
  /^\/forgot-password(\/|$)/,
  /^\/reset-password(\/|$)/,
  /^\/auth\//,
  /^\/api\/health$/,
  /^\/api\/webhook\//,
  /^\/api\/cron\//,
  /^\/_next\//,
  /^\/favicon\.ico$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((re) => re.test(pathname));
}

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresca la sesion (revalida cookies expiradas).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = req.nextUrl;

  // Si es publica y el usuario YA tiene sesion, redirige fuera de las paginas de auth.
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/forgot-password"))) {
    return NextResponse.redirect(new URL("/services", req.url));
  }

  // Si la ruta requiere sesion y no hay usuario, redirige a /login con redirect-back.
  if (!user && !isPublic(pathname)) {
    const next = encodeURIComponent(pathname + (search ?? ""));
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto archivos estaticos del build
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
