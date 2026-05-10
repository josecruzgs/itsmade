import { AdminShell } from "@/components/AdminShell";
import {
  ReactivateButton,
  CloseConversationButton,
} from "@/components/ConversationActions";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ConversationListRow {
  id: string;
  whatsapp_phone: string;
  agent_type: string;
  status: string;
  last_message_at: string;
  state: { handoff?: { reason?: string; at?: string } | null } | null;
  customer: { name: string | null } | null;
}

const statusBadge: Record<string, string> = {
  active: "badge-success",
  awaiting_response: "badge-warning",
  escalated: "badge-warning",
  closed: "badge-neutral",
};

export default async function ConversationsPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("conversations")
    .select(
      `
      id, whatsapp_phone, agent_type, status, last_message_at, state,
      customer:customers!conversations_customer_id_fkey(name)
      `,
    )
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <AdminShell title="Conversaciones">
        <div className="card p-4 text-sm text-red-600 dark:text-red-400">
          Error: {error.message}
        </div>
      </AdminShell>
    );
  }

  const rows = (data ?? []) as unknown as ConversationListRow[];
  const escalatedCount = rows.filter((r) => r.status === "escalated").length;

  return (
    <AdminShell
      title="Conversaciones"
      description={`Últimas ${rows.length} conversaciones por WhatsApp.`}
    >
      {escalatedCount > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 flex-shrink-0"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
          </svg>
          <div className="flex-1">
            <strong>
              {escalatedCount}{" "}
              {escalatedCount === 1
                ? "conversación escalada"
                : "conversaciones escaladas"}
            </strong>{" "}
            esperan atención humana. El bot ya no responde a esos números hasta que
            uses <em>&quot;Reactivar bot&quot;</em> o <em>&quot;Cerrar&quot;</em>.
            Mientras, atiende al cliente desde tu WhatsApp Business.
          </div>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Agente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Último mensaje</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {c.whatsapp_phone}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {c.customer?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-brand">{c.agent_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={statusBadge[c.status] ?? "badge-neutral"}>
                        {c.status}
                      </span>
                      {c.status === "escalated" && c.state?.handoff?.reason ? (
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          {c.state.handoff.reason}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                    {new Date(c.last_message_at).toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "escalated" ? (
                      <div className="flex justify-end gap-2">
                        <ReactivateButton id={c.id} />
                        <CloseConversationButton id={c.id} />
                      </div>
                    ) : c.status !== "closed" ? (
                      <CloseConversationButton id={c.id} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Sin conversaciones todavía.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
