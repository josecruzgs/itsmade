"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

export interface NavUser {
  email: string;
  role: "admin" | "user";
  fullName: string | null;
}

type IconName =
  | "services"
  | "intake"
  | "clients"
  | "employees"
  | "feedback"
  | "conversations"
  | "branches"
  | "catalog"
  | "users"
  | "settings";

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
}

const MAIN_LINKS: NavLink[] = [
  { href: "/services", label: "Servicios", icon: "services" },
  { href: "/intake", label: "Solicitudes", icon: "intake" },
  { href: "/clients", label: "Clientes", icon: "clients" },
  { href: "/employees", label: "Empleados", icon: "employees" },
  { href: "/feedback", label: "Feedback", icon: "feedback" },
  { href: "/conversations", label: "Conversaciones", icon: "conversations" },
  { href: "/branches", label: "Sucursales", icon: "branches" },
  { href: "/catalog", label: "Catálogo", icon: "catalog" },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/users", label: "Usuarios", icon: "users", adminOnly: true },
  { href: "/settings", label: "Configuración", icon: "settings", adminOnly: true },
];

export function Sidebar({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cerrar overlay al cambiar de ruta (mobile).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloquear scroll del body cuando el overlay esta abierto.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const showAdminLinks = user?.role === "admin";

  return (
    <>
      {/* Top bar SOLO en mobile/tablet (< lg) */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/85 px-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"
        >
          <Image
            src="/logo.png"
            alt="itsMade"
            width={28}
            height={28}
            priority
            className="h-7 w-7 rounded-md object-contain"
          />
          <span>itsMade</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <UserMenu email={user.email} role={user.role} fullName={user.fullName} />
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              Entrar
            </Link>
          )}
        </div>
      </div>

      {/* Backdrop para mobile cuando el sidebar esta abierto */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Sidebar: overlay en mobile (deslizante), fija en lg+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navegacion principal"
      >
        {/* Header del sidebar: logo + brand + boton cerrar (mobile) */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"
          >
            <Image
              src="/logo.png"
              alt="itsMade"
              width={32}
              height={32}
              priority
              className="h-8 w-8 rounded-md object-contain"
            />
            <span>itsMade</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lista de links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {MAIN_LINKS.map((link) => (
              <li key={link.href}>
                <NavItem link={link} active={isActive(link.href)} />
              </li>
            ))}
          </ul>

          {showAdminLinks ? (
            <>
              <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
              <div className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Admin
              </div>
              <ul className="space-y-0.5">
                {ADMIN_LINKS.map((link) => (
                  <li key={link.href}>
                    <NavItem link={link} active={isActive(link.href)} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>

        {/* Footer del sidebar: theme + user menu (solo desktop, en mobile estan en top bar) */}
        <div className="hidden shrink-0 items-center justify-between border-t border-slate-200 p-3 dark:border-slate-800 lg:flex">
          <ThemeToggle />
          {user ? (
            <UserMenu
              email={user.email}
              role={user.role}
              fullName={user.fullName}
              placement="top"
            />
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              Iniciar sesion
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
    >
      <NavIcon name={link.icon} />
      <span>{link.label}</span>
    </Link>
  );
}

function NavIcon({ name }: { name: IconName }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "services":
      return (
        <svg {...props}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect width="8" height="4" x="8" y="2" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "intake":
      return (
        <svg {...props}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "clients":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "employees":
      return (
        <svg {...props}>
          <path d="M2 18h20v3H2zM4 18v-3a8 8 0 0 1 16 0v3" />
          <path d="M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "feedback":
      return (
        <svg {...props}>
          <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
        </svg>
      );
    case "conversations":
      return (
        <svg {...props}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case "branches":
      return (
        <svg {...props}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "catalog":
      return (
        <svg {...props}>
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}
