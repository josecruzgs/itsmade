-- =============================================================================
-- itsMade — Extensiones para soportar CRUD de servicios desde el panel.
-- Agrega:
--   - customers.company_name      → nombre de empresa cuando aplica
--   - service_jobs.address         → direccion donde se presta el servicio
--   - service_jobs.cost_mxn        → costo final del servicio (distinto del
--                                     base_price del catalogo)
-- Idempotente.
-- =============================================================================

alter table customers
  add column if not exists company_name text;

alter table service_jobs
  add column if not exists address text;

alter table service_jobs
  add column if not exists cost_mxn numeric(10,2);

create index if not exists service_jobs_scheduled_at_idx
  on service_jobs(scheduled_at desc) where scheduled_at is not null;
