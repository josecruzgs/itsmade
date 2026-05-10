"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ServiceJobModal } from "@/components/ServicesPanel";
import type {
  BranchRow,
  ServiceCategoryRow,
  ServiceRow,
} from "@/lib/supabase/types";

export interface IntakeConvertSeed {
  intakeId: string;
  customer: {
    id?: string;
    name: string | null;
    company_name: string | null;
    whatsapp_phone: string;
    email: string | null;
  };
  description: string | null;
}

/**
 * Boton "Convertir a servicio" para una fila de /intake.
 * Abre el ServiceJobModal precargado con los datos del cliente del intake y
 * la descripcion como notas iniciales. Al guardar, createServiceJob detecta
 * el hidden intake_id y marca el intake como 'converted' con el service_job_id.
 */
export function IntakeConvertButton({
  seed,
  branches,
  categories,
  services,
  className = "btn-primary w-full text-xs",
  label = "Convertir a servicio",
}: {
  seed: IntakeConvertSeed;
  branches: BranchRow[];
  categories: ServiceCategoryRow[];
  services: ServiceRow[];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </button>

      {open ? (
        <ServiceJobModal
          job={null}
          initialCustomer={seed.customer}
          initialNotes={seed.description}
          intakeId={seed.intakeId}
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
