-- =============================================================================
-- itsMade — Empleados + asignacion de servicio + envio de hoja PDF.
--
-- Agrega:
--   - Tabla `employees` (operadores de itsMade que ejecutan los servicios).
--   - service_jobs.assigned_employee_id  → quien va a hacer el servicio.
--   - service_jobs.pdf_sent_at           → timestamp del ultimo envio de hoja.
--
-- Nota: el bucket de Storage `service-pdfs` se crea desde el admin client
-- en runtime (ver src/lib/storage/service-pdfs.ts) o manualmente desde el
-- dashboard de Supabase. Esta migracion no toca Storage.
--
-- Idempotente.
-- =============================================================================

create table if not exists employees (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  position        text,
  area            text,
  whatsapp_phone  text not null unique,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists employees_active_idx on employees(active) where active;
create index if not exists employees_area_idx on employees(area);

create or replace function employees_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists employees_updated_at_trigger on employees;
create trigger employees_updated_at_trigger
  before update on employees
  for each row execute function employees_set_updated_at();

-- Asignacion de un empleado al servicio + timestamp del envio de la hoja PDF.
alter table service_jobs
  add column if not exists assigned_employee_id uuid references employees(id) on delete set null;
alter table service_jobs
  add column if not exists pdf_sent_at timestamptz;

create index if not exists service_jobs_assigned_employee_idx
  on service_jobs(assigned_employee_id) where assigned_employee_id is not null;
