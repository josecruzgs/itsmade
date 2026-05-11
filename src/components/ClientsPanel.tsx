"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ServiceJobModal,
  type ServiceJobModalInitialCustomer,
} from "@/components/ServicesPanel";
import { ClientDetailModal } from "@/components/ClientDetailModal";
import type {
  BranchRow,
  EmployeeRow,
  ServiceCategoryRow,
  ServiceRow,
} from "@/lib/supabase/types";

export interface ClientRow {
  id: string;
  whatsapp_phone: string;
  name: string | null;
  email: string | null;
  company_name: string | null;
  created_at: string;
  total_services: number;
  last_service_at: string | null;
}

export function ClientsPanel({
  clients,
  branches,
  categories,
  services,
  employees,
}: {
  clients: ClientRow[];
  branches: BranchRow[];
  categories: ServiceCategoryRow[];
  services: ServiceRow[];
  employees: EmployeeRow[];
}) {
  const router = useRouter();
  const [creatingFor, setCreatingFor] =
    useState<ServiceJobModalInitialCustomer | null>(null);
  const [viewing, setViewing] = useState<ClientRow | null>(null);

  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Servicios</th>
                <th className="px-4 py-3 font-medium">Último servicio</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {c.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {c.company_name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {c.whatsapp_phone}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-brand">{c.total_services}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {c.last_service_at
                      ? new Date(c.last_service_at).toLocaleDateString("es-MX")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing(c)}
                        className="btn-ghost whitespace-nowrap text-xs"
                      >
                        Ver / editar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCreatingFor({
                            id: c.id,
                            name: c.name,
                            company_name: c.company_name,
                            whatsapp_phone: c.whatsapp_phone,
                            email: c.email,
                          })
                        }
                        className="btn-primary whitespace-nowrap text-xs"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Nuevo servicio
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No hay clientes con esos filtros. Los clientes se crean
                    automáticamente al registrar un servicio en{" "}
                    <strong>/services</strong>.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {creatingFor ? (
        <ServiceJobModal
          job={null}
          initialCustomer={creatingFor}
          branches={branches}
          categories={categories}
          services={services}
          employees={employees}
          onClose={() => {
            setCreatingFor(null);
            router.refresh();
          }}
        />
      ) : null}

      {viewing ? (
        <ClientDetailModal
          client={viewing}
          onClose={() => {
            setViewing(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
