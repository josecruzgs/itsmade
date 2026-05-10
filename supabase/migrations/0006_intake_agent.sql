-- =============================================================================
-- itsMade — Agente 'intake' (registro de solicitudes de servicio).
--
-- Flujo:
--   1. Cliente escribe por WhatsApp pidiendo un servicio.
--   2. Agente info detecta la intencion y dispara `start_intake` (cambia
--      agent_type a 'intake').
--   3. Agente intake pregunta nombre, celular y descripcion breve.
--   4. Si el celular existe en `customers`, reusa el customer_id; si no,
--      crea uno nuevo.
--   5. Inserta `service_intake_requests` (status='pending_review') y escala
--      la conversacion (status='escalated') para que un humano la atienda.
--   6. Humano ve la solicitud en /intake, crea el service_jobs definitivo,
--      marca el intake como 'converted' y reactiva el bot.
--
-- Idempotente.
-- =============================================================================

-- Extender agent_type para incluir 'intake'.
alter table conversations drop constraint conversations_agent_type_check;
alter table conversations add constraint conversations_agent_type_check
  check (agent_type in ('feedback', 'info', 'intake'));

-- Tabla de solicitudes en estado lead/intake (pre service_jobs).
do $$ begin
  create type intake_request_status as enum (
    'pending_review',  -- agente registro, esperando humano
    'in_review',       -- humano ya asigno a alguien o esta trabajando
    'converted',       -- humano creo el service_jobs definitivo
    'dismissed'        -- humano descarto (spam, duplicado, etc.)
  );
exception when duplicate_object then null; end $$;

create table if not exists service_intake_requests (
  id                        uuid primary key default gen_random_uuid(),
  conversation_id           uuid not null references conversations(id) on delete cascade,
  customer_id               uuid not null references customers(id) on delete restrict,
  -- Datos crudos capturados por el agente (pueden diferir de customers.*).
  requested_name            text not null,
  requested_phone           text not null,
  raw_request_description   text,
  -- Pipeline.
  status                    intake_request_status not null default 'pending_review',
  assigned_to_profile_id    uuid references profiles(id) on delete set null,
  service_job_id            uuid references service_jobs(id) on delete set null,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists service_intake_requests_status_idx
  on service_intake_requests(status, created_at desc);
create index if not exists service_intake_requests_conversation_idx
  on service_intake_requests(conversation_id);
create index if not exists service_intake_requests_customer_idx
  on service_intake_requests(customer_id);

-- Trigger updated_at (reusa el patron de otras tablas).
create or replace function service_intake_requests_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists service_intake_requests_updated_at_trigger on service_intake_requests;
create trigger service_intake_requests_updated_at_trigger
  before update on service_intake_requests
  for each row execute function service_intake_requests_set_updated_at();
