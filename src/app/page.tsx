import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl dark:bg-brand-600/20" />
        <div className="absolute right-0 top-40 h-[300px] w-[300px] rounded-full bg-accent-400/20 blur-3xl dark:bg-accent-500/15" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/10" />
      </div>

      <main className="relative mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <header className="mb-14 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-400/30 dark:bg-brand-500/20 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> itsMade
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl md:text-6xl">
            Servicios profesionales de{" "}
            <span className="bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
              limpieza
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            Panel de gestión y feedback automatizado por WhatsApp para nuestros
            servicios residenciales, comerciales e industriales.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="btn-primary px-5 py-2.5 text-sm">
              Entrar al panel
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="/api/health"
              className="btn-ghost px-5 py-2.5 text-sm"
              target="_blank"
              rel="noopener"
            >
              Health check
            </a>
          </div>
        </header>

        <section className="card p-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Estado del sistema
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <Link className="font-mono text-brand-600 hover:underline dark:text-brand-400" href="/api/health">
                GET /api/health
              </Link>
              <span>— health check del API.</span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                POST /api/webhook/evolution
              </code>
              <span>— endpoint donde Evolution API entrega los mensajes.</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
