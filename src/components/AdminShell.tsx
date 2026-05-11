import { Sidebar } from "@/components/Sidebar";
import { getCurrentUser } from "@/lib/auth/session";

export async function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const navUser = user
    ? { email: user.email, role: user.role, fullName: user.fullName }
    : null;

  return (
    <div className="min-h-screen">
      <Sidebar user={navUser} />
      {/* Main: en mobile deja espacio para el top bar (h-14), en lg+ deja espacio
          para el sidebar fijo (w-64). */}
      <main className="px-4 pb-16 pt-20 sm:px-6 lg:pl-72 lg:pr-8 lg:pt-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
