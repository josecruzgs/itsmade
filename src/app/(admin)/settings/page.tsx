import { AdminShell } from "@/components/AdminShell";
import { SettingsCleanup } from "@/components/SettingsCleanup";
import { SettingsEvolution } from "@/components/SettingsEvolution";
import {
  getCleanupPreview,
  getEvolutionStatus,
  getSettingsInfo,
} from "@/lib/settings/actions";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [info, cleanupInitial, evolutionStatus] = await Promise.all([
    getSettingsInfo(),
    getCleanupPreview(72),
    getEvolutionStatus(),
  ]);

  const sb = supabaseServer();
  const [convs, fbReqs] = await Promise.all([
    sb.from("conversations").select("id", { count: "exact", head: true }),
    sb.from("feedback_requests").select("id", { count: "exact", head: true }),
  ]);
  const convCount = convs.count ?? 0;
  const fbCount = fbReqs.count ?? 0;

  return (
    <AdminShell
      title="Configuración"
      description="Estado de WhatsApp, limpieza de base de datos y configuración del sistema."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsEvolution initial={evolutionStatus} />

        <div className="card flex flex-col p-5">
          <div className="mb-1 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Resumen del sistema
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Configuración actual del agente y volúmenes en DB.
              </p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-600 ring-1 ring-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini label="Conversaciones" value={convCount} />
            <Mini label="Solicitudes feedback" value={fbCount} />
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <ConfigRow label="Modelo Claude" value={info.model} />
            <ConfigRow label="Instancia Evolution" value={info.instanceName} />
            <ConfigRow
              label="Auto-cierre conversaciones"
              value={`${info.autoCloseHours}h`}
            />
            <ConfigRow
              label="Expiración feedback"
              value={`${info.feedbackExpiryHours}h`}
            />
          </dl>

          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
            Para cambiar estos valores, edita las variables de entorno en Vercel
            (o <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">.env.local</code> en
            desarrollo) y haz redeploy.
          </p>
        </div>

        <SettingsCleanup initial={cleanupInitial} />
      </div>
    </AdminShell>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
      <dt className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}
