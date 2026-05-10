"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

const links = [
  { href: "/services", label: "Servicios" },
  { href: "/feedback", label: "Feedback" },
  { href: "/conversations", label: "Conversaciones" },
  { href: "/branches", label: "Sucursales" },
  { href: "/catalog", label: "Catálogo" },
];

export interface NavUser {
  email: string;
  role: "admin" | "user";
  fullName: string | null;
}

export function FloatingNav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-4 sm:px-4">
      <nav
        className="pointer-events-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/70 px-3 py-2 shadow-nav backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 sm:px-4 sm:py-2.5"
        aria-label="Navegación principal"
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-semibold text-slate-900 hover:opacity-80 dark:text-white"
        >
          <Logo />
          <span>itsMade</span>
        </Link>

        {/* Links desktop (solo si hay sesion) */}
        {user ? (
          <ul className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive(l.href)
                      ? "bg-slate-900/5 text-slate-900 dark:bg-white/10 dark:text-white"
                      : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="hidden lg:block" />
        )}

        <div className="flex items-center gap-2">
          {user?.role === "admin" ? (
            <>
              <Link
                href="/users"
                aria-label="Usuarios"
                title="Usuarios"
                className={`hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/60 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:flex ${
                  isActive("/users") ? "ring-2 ring-brand-500/40" : ""
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </Link>
              <Link
                href="/settings"
                aria-label="Configuración"
                title="Configuración"
                className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/60 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
                  isActive("/settings") ? "ring-2 ring-brand-500/40" : ""
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
            </>
          ) : null}
          <ThemeToggle />
          {user ? (
            <UserMenu email={user.email} role={user.role} fullName={user.fullName} />
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              Iniciar sesión
            </Link>
          )}
          {/* Hamburger mobile/tablet */}
          {user ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menú"
              aria-expanded={open}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/60 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              {open ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          ) : null}
        </div>

        {/* Menu mobile dropdown */}
        {open && user ? (
          <div className="absolute inset-x-0 top-full mt-2 animate-fade-in lg:hidden">
            <ul className="mx-3 flex flex-col gap-1 rounded-2xl border border-white/40 bg-white/90 p-2 shadow-nav backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive(l.href)
                        ? "bg-slate-900/5 text-slate-900 dark:bg-white/10 dark:text-white"
                        : "text-slate-700 hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/5"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {user.role === "admin" ? (
                <>
                  <li>
                    <Link
                      href="/users"
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive("/users")
                          ? "bg-slate-900/5 text-slate-900 dark:bg-white/10 dark:text-white"
                          : "text-slate-700 hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      Usuarios
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings"
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive("/settings")
                          ? "bg-slate-900/5 text-slate-900 dark:bg-white/10 dark:text-white"
                          : "text-slate-700 hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      Configuración
                    </Link>
                  </li>
                </>
              ) : null}
            </ul>
          </div>
        ) : null}
      </nav>
    </div>
  );
}

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-600 text-white shadow-sm">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}
