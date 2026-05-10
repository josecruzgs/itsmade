"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { BranchRow, ServiceJobStatus } from "@/lib/supabase/types";

const STATUS_OPTIONS: Array<{ value: ServiceJobStatus | "all"; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "scheduled", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "completed", label: "Realizado" },
  { value: "cancelled", label: "Cancelado" },
];

/**
 * Filtros de /services como dos <select> que auto-navegan al cambiar.
 * Resetea `page` a 1 al cambiar cualquier filtro (igual que hacian las pills).
 * Mantiene el resto de query params (q, sort, dir) intactos.
 */
export function ServicesFilters({
  status,
  branch,
  branches,
}: {
  status: string;
  branch: string;
  branches: BranchRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function navigateWith(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    // Cualquier cambio de filtro vuelve a la pagina 1.
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/services?${qs}` : "/services");
    });
  }

  const hasActiveFilter =
    (status && status !== "all") || (branch && branch !== "all");

  return (
    <>
      <select
        aria-label="Filtrar por estado"
        value={status || "all"}
        onChange={(e) => navigateWith({ status: e.target.value })}
        disabled={pending}
        className="field min-w-[150px] py-1.5"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por sucursal"
        value={branch || "all"}
        onChange={(e) => navigateWith({ branch: e.target.value })}
        disabled={pending}
        className="field min-w-[170px] py-1.5"
      >
        <option value="all">Todas las sucursales</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.city} — {b.name}
          </option>
        ))}
      </select>

      {hasActiveFilter ? (
        <button
          type="button"
          onClick={() => navigateWith({ status: null, branch: null })}
          disabled={pending}
          className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Limpiar filtros
        </button>
      ) : null}
    </>
  );
}
