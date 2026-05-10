"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ServiceJobModal } from "@/components/ServicesPanel";
import type {
  BranchRow,
  ServiceCategoryRow,
  ServiceRow,
} from "@/lib/supabase/types";

/**
 * Boton "Nuevo servicio" del header de /services. Antes vivia dentro del
 * ServicesPanel (que sigue manejando edicion de filas), pero el header del
 * AdminShell necesita un componente client autonomo con su propia modal.
 */
export function NewServiceButton({
  branches,
  categories,
  services,
}: {
  branches: BranchRow[];
  categories: ServiceCategoryRow[];
  services: ServiceRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary whitespace-nowrap"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nuevo servicio
      </button>

      {open ? (
        <ServiceJobModal
          job={null}
          branches={branches}
          categories={categories}
          services={services}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
