-- =============================================================================
-- itsMade — Esquema inicial
-- Servicios profesionales de limpieza (residencial, comercial, industrial)
-- + agente de feedback post-servicio por WhatsApp.
--
-- RLS desactivado en data tables (todos los accesos pasan por server con
-- service-role). RLS solo se activa en `profiles` en la migración 0002.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =============================================================================
-- Sucursales
-- =============================================================================
create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text not null,
  state       text,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists branches_active_idx on branches(active) where active;
create index if not exists branches_city_idx on branches(city);

-- =============================================================================
-- Categorías de servicio (residencial | comercial | industrial)
-- =============================================================================
create table if not exists service_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
                check (slug in ('residencial','comercial','industrial')),
  name        text not null,
  description text
);

-- =============================================================================
-- Servicios concretos
-- =============================================================================
create table if not exists services (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  category_id     uuid not null references service_categories(id) on delete restrict,
  description     text,
  base_price_mxn  numeric(10,2),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists services_category_active_idx on services(category_id, active);

-- =============================================================================
-- Clientes
-- =============================================================================
create table if not exists customers (
  id              uuid primary key default gen_random_uuid(),
  whatsapp_phone  text not null unique,
  name            text,
  email           text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function customers_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists customers_updated_at_trigger on customers;
create trigger customers_updated_at_trigger
  before update on customers
  for each row execute function customers_set_updated_at();

-- =============================================================================
-- Trabajos / órdenes de servicio
-- =============================================================================
do $$ begin
  create type service_job_status as enum ('scheduled','in_progress','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists service_jobs (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete restrict,
  branch_id     uuid not null references branches(id) on delete restrict,
  service_id    uuid not null references services(id) on delete restrict,
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  status        service_job_status not null default 'scheduled',
  notes         text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists service_jobs_status_idx on service_jobs(status);
create index if not exists service_jobs_completed_at_idx
  on service_jobs(completed_at desc) where completed_at is not null;
create index if not exists service_jobs_branch_idx on service_jobs(branch_id, status);
create index if not exists service_jobs_customer_idx on service_jobs(customer_id);

-- =============================================================================
-- Conversaciones (multi-agente desde el día uno via agent_type)
-- =============================================================================
do $$ begin
  create type conversation_status as enum ('active','awaiting_response','closed','escalated');
exception when duplicate_object then null; end $$;

create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid references customers(id) on delete set null,
  whatsapp_phone   text not null,
  agent_type       text not null default 'feedback'
                     check (agent_type in ('feedback')),
  status           conversation_status not null default 'active',
  state            jsonb not null default '{}'::jsonb,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists conversations_status_idx on conversations(status);
create index if not exists conversations_phone_idx on conversations(whatsapp_phone);
create index if not exists conversations_agent_status_idx on conversations(agent_type, status);
create index if not exists conversations_last_msg_idx on conversations(last_message_at desc);

-- =============================================================================
-- Mensajes (idempotencia via evolution_message_id UNIQUE)
-- =============================================================================
do $$ begin
  create type message_role as enum ('user','assistant','system','tool');
exception when duplicate_object then null; end $$;

create table if not exists messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references conversations(id) on delete cascade,
  role                  message_role not null,
  content               text,
  media_url             text,
  media_type            text,
  evolution_message_id  text unique,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
create index if not exists messages_conv_created_idx on messages(conversation_id, created_at);

-- =============================================================================
-- Solicitudes de feedback (una por service_job, agente las ejecuta vía WhatsApp)
-- =============================================================================
create table if not exists feedback_requests (
  id                       uuid primary key default gen_random_uuid(),
  service_job_id           uuid not null references service_jobs(id) on delete cascade,
  customer_id              uuid not null references customers(id) on delete cascade,
  branch_id                uuid not null references branches(id) on delete restrict,
  service_id               uuid not null references services(id) on delete restrict,
  conversation_id          uuid references conversations(id) on delete set null,
  requested_by_profile_id  uuid,  -- FK a profiles agregada en 0003
  opening_message_id       uuid references messages(id) on delete set null,
  status                   text not null default 'pending'
                             check (status in ('pending','in_progress','completed','expired','escalated','cancelled')),
  score_overall_avg        numeric(3,1),
  nps_bucket               text check (nps_bucket in ('promoter','passive','detractor')),
  sent_at                  timestamptz,
  completed_at             timestamptz,
  expired_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Solo una solicitud abierta por job (anti doble-click del admin).
create unique index if not exists feedback_requests_one_open_per_job
  on feedback_requests(service_job_id) where status in ('pending','in_progress');

create index if not exists feedback_requests_status_idx on feedback_requests(status);
create index if not exists feedback_requests_branch_status_idx on feedback_requests(branch_id, status);
create index if not exists feedback_requests_service_status_idx on feedback_requests(service_id, status);
create index if not exists feedback_requests_completed_at_idx
  on feedback_requests(completed_at desc) where completed_at is not null;
create index if not exists feedback_requests_sent_at_idx
  on feedback_requests(sent_at) where status in ('pending','in_progress');

create or replace function feedback_requests_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists feedback_requests_updated_at_trigger on feedback_requests;
create trigger feedback_requests_updated_at_trigger
  before update on feedback_requests
  for each row execute function feedback_requests_set_updated_at();

-- =============================================================================
-- Respuestas individuales (5 por solicitud)
-- =============================================================================
create table if not exists feedback_answers (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references feedback_requests(id) on delete cascade,
  question_index      smallint not null check (question_index between 1 and 5),
  raw_answer          text not null,
  normalized_score    smallint check (normalized_score between 1 and 5),
  normalized_text     text,
  answered_at         timestamptz not null default now(),
  unique (request_id, question_index)
);
create index if not exists feedback_answers_request_idx on feedback_answers(request_id);
create index if not exists feedback_answers_score_idx
  on feedback_answers(question_index, normalized_score)
  where normalized_score is not null;

-- =============================================================================
-- Vista agregada de métricas (para dashboard futuro)
-- Tres scopes: branch | service_category | service
-- =============================================================================
create or replace view feedback_metrics_v as
with completed as (
  select
    fr.*,
    case when fr.completed_at >= now() - interval '7 days'  then 1 else 0 end as in_7d,
    case when fr.completed_at >= now() - interval '30 days' then 1 else 0 end as in_30d
  from feedback_requests fr
)
select
  'branch'::text as scope_type,
  branch_id      as scope_id,
  count(*) filter (where status='completed')                as completed_total,
  count(*) filter (where status='completed' and in_7d=1)    as completed_7d,
  count(*) filter (where status='completed' and in_30d=1)   as completed_30d,
  count(*) filter (where status='pending')                  as pending_count,
  count(*) filter (where status='in_progress')              as in_progress_count,
  count(*) filter (where status='expired')                  as expired_count,
  count(*) filter (where status='escalated')                as escalated_count,
  count(*) filter (where nps_bucket='promoter')             as promoter_count,
  count(*) filter (where nps_bucket='passive')              as passive_count,
  count(*) filter (where nps_bucket='detractor')            as detractor_count,
  avg(score_overall_avg) filter (where status='completed')  as score_overall_avg
from completed
group by branch_id

union all

select
  'service_category'::text,
  s.category_id,
  count(*) filter (where c.status='completed'),
  count(*) filter (where c.status='completed' and c.in_7d=1),
  count(*) filter (where c.status='completed' and c.in_30d=1),
  count(*) filter (where c.status='pending'),
  count(*) filter (where c.status='in_progress'),
  count(*) filter (where c.status='expired'),
  count(*) filter (where c.status='escalated'),
  count(*) filter (where c.nps_bucket='promoter'),
  count(*) filter (where c.nps_bucket='passive'),
  count(*) filter (where c.nps_bucket='detractor'),
  avg(c.score_overall_avg) filter (where c.status='completed')
from completed c
join services s on s.id = c.service_id
group by s.category_id

union all

select
  'service'::text,
  service_id,
  count(*) filter (where status='completed'),
  count(*) filter (where status='completed' and in_7d=1),
  count(*) filter (where status='completed' and in_30d=1),
  count(*) filter (where status='pending'),
  count(*) filter (where status='in_progress'),
  count(*) filter (where status='expired'),
  count(*) filter (where status='escalated'),
  count(*) filter (where nps_bucket='promoter'),
  count(*) filter (where nps_bucket='passive'),
  count(*) filter (where nps_bucket='detractor'),
  avg(score_overall_avg) filter (where status='completed')
from completed
group by service_id;

-- =============================================================================
-- Vista por pregunta (P1..P5) — promedios por scope
-- =============================================================================
create or replace view feedback_question_metrics_v as
with answers as (
  select
    fa.question_index,
    fa.normalized_score,
    fr.branch_id,
    fr.service_id,
    s.category_id
  from feedback_answers fa
  join feedback_requests fr on fr.id = fa.request_id
  join services s on s.id = fr.service_id
  where fr.status = 'completed'
)
select
  'branch'::text as scope_type,
  branch_id      as scope_id,
  question_index,
  avg(normalized_score) filter (where normalized_score is not null) as avg_score,
  count(*) filter (where normalized_score is not null)              as answered_count
from answers
group by branch_id, question_index

union all

select
  'service_category'::text,
  category_id,
  question_index,
  avg(normalized_score) filter (where normalized_score is not null),
  count(*) filter (where normalized_score is not null)
from answers
group by category_id, question_index

union all

select
  'service'::text,
  service_id,
  question_index,
  avg(normalized_score) filter (where normalized_score is not null),
  count(*) filter (where normalized_score is not null)
from answers
group by service_id, question_index;
