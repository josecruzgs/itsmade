"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateCategory,
  createService,
  updateService,
  toggleServiceActive,
  deleteService,
} from "@/lib/catalog/actions";
import type { ActionResult } from "@/lib/auth/actions";
import type { ServiceCategoryRow, ServiceRow } from "@/lib/supabase/types";

export function CatalogPanel({
  categories,
  services,
}: {
  categories: ServiceCategoryRow[];
  services: Array<ServiceRow & { category_slug?: string }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"services" | "categories">("services");
  const [editingService, setEditingService] = useState<ServiceRow | "new" | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<ServiceCategoryRow | null>(null);

  return (
    <div className="space-y-5">
      <div className="card flex items-center justify-between gap-3 p-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("services")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === "services"
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Servicios ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("categories")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === "categories"
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Categorías ({categories.length})
          </button>
        </div>
        {tab === "services" ? (
          <button
            type="button"
            onClick={() => setEditingService("new")}
            className="btn-primary whitespace-nowrap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nuevo servicio
          </button>
        ) : null}
      </div>

      {tab === "services" ? (
        <ServicesTable
          services={services}
          onEdit={(s) => setEditingService(s)}
        />
      ) : (
        <CategoriesTable
          categories={categories}
          onEdit={(c) => setEditingCategory(c)}
        />
      )}

      {editingService ? (
        <ServiceModal
          categories={categories}
          service={editingService === "new" ? null : editingService}
          onClose={() => {
            setEditingService(null);
            router.refresh();
          }}
        />
      ) : null}

      {editingCategory ? (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setEditingCategory(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ServicesTable({
  services,
  onEdit,
}: {
  services: Array<ServiceRow & { category_slug?: string }>;
  onEdit: (s: ServiceRow) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Precio base (MXN)</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {services.map((s) => (
              <tr
                key={s.id}
                className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {s.code}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {s.name}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {s.category_slug ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {s.base_price_mxn !== null
                    ? `$${s.base_price_mxn.toLocaleString("es-MX")}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={s.active ? "badge-success" : "badge-neutral"}>
                    {s.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(s)}
                      className="btn-ghost text-xs"
                    >
                      Editar
                    </button>
                    <form action={toggleServiceActive} className="inline-flex">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={String(s.active)} />
                      <button type="submit" className="btn-ghost text-xs">
                        {s.active ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                    <form
                      action={deleteService}
                      onSubmit={(e) => {
                        if (
                          !confirm(
                            `¿Eliminar el servicio ${s.code}? Si tiene servicios registrados, fallará.`,
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                      className="inline-flex"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn-danger">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                >
                  Sin servicios. Crea el primero con el botón superior.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTable({
  categories,
  onEdit,
}: {
  categories: ServiceCategoryRow[];
  onEdit: (c: ServiceCategoryRow) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((c) => (
              <tr
                key={c.id}
                className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="badge-brand">{c.slug}</span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {c.description ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    className="btn-ghost text-xs"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Los slugs son fijos por diseño (residencial, comercial, industrial). Solo
        se editan nombre y descripción.
      </p>
    </div>
  );
}

function ServiceModal({
  service,
  categories,
  onClose,
}: {
  service: ServiceRow | null;
  categories: ServiceCategoryRow[];
  onClose: () => void;
}) {
  const isNew = service === null;
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    isNew ? createService : updateService,
    null,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <ModalShell title={isNew ? "Nuevo servicio" : "Editar servicio"} onClose={onClose}>
      <form action={action} className="space-y-4 px-6 py-5">
        {!isNew ? <input type="hidden" name="id" value={service.id} /> : null}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Código <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            name="code"
            required
            pattern="[A-Z0-9-]+"
            defaultValue={service?.code ?? ""}
            className="field font-mono uppercase"
            placeholder="RES-CASA-STD"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nombre <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            name="name"
            required
            defaultValue={service?.name ?? ""}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Categoría <span className="text-red-500">*</span>
          </span>
          <select
            name="category_id"
            defaultValue={service?.category_id ?? ""}
            required
            className="field"
          >
            <option value="">Selecciona…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Descripción
          </span>
          <textarea
            name="description"
            defaultValue={service?.description ?? ""}
            rows={3}
            className="field resize-y"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Precio base (MXN)
          </span>
          <input
            type="number"
            name="base_price_mxn"
            defaultValue={service?.base_price_mxn ?? ""}
            min={0}
            step="0.01"
            className="field"
            placeholder="Opcional"
          />
        </label>

        {state && !state.ok ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Guardando…" : isNew ? "Crear" : "Guardar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CategoryModal({
  category,
  onClose,
}: {
  category: ServiceCategoryRow;
  onClose: () => void;
}) {
  const [state, action, isPending] = useActionState<ActionResult | null, FormData>(
    updateCategory,
    null,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <ModalShell title={`Editar categoría: ${category.slug}`} onClose={onClose}>
      <form action={action} className="space-y-4 px-6 py-5">
        <input type="hidden" name="id" value={category.id} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nombre <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            name="name"
            required
            defaultValue={category.name}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Descripción
          </span>
          <textarea
            name="description"
            defaultValue={category.description ?? ""}
            rows={3}
            className="field resize-y"
          />
        </label>

        {state && !state.ok ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-md animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
