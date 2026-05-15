-- =============================================================================
-- itsMade — Agente de recomendaciones (batch, no conversacional).
--
-- Agrega:
--   - tabla improvement_reports: reportes generados por el agente que analiza
--     en bloque feedback completado. Cada reporte se marca como 'pending' o
--     'applied' por el admin.
--   - feedback_requests.analyzed_in_report_id: apunta al reporte que lo
--     analizo (null = "No analizado"). Se llena al ejecutar el agente.
--
-- A diferencia de info/intake/feedback, este agente NO entra en
-- conversations.agent_type — es batch one-shot disparado desde
-- /recommendations con un boton del admin.
--
-- Idempotente.
-- =============================================================================

create table if not exists improvement_reports (
  id                       uuid primary key default gen_random_uuid(),
  generated_at             timestamptz not null default now(),
  generated_by_profile_id  uuid references profiles(id) on delete set null,
  feedback_count           integer not null check (feedback_count > 0),
  report_markdown          text not null,
  status                   text not null
                             default 'pending'
                             check (status in ('pending','applied')),
  applied_at               timestamptz,
  applied_by_profile_id    uuid references profiles(id) on delete set null,
  applied_notes            text
);

create index if not exists improvement_reports_status_generated_idx
  on improvement_reports(status, generated_at desc);

-- Backfill seguro: la columna se agrega null y luego se referencia.
alter table feedback_requests
  add column if not exists analyzed_in_report_id uuid
    references improvement_reports(id) on delete set null;

create index if not exists feedback_requests_analyzed_idx
  on feedback_requests(analyzed_in_report_id)
  where analyzed_in_report_id is not null;

-- Indice util para la query del agente: feedback completado y no analizado.
create index if not exists feedback_requests_unanalyzed_completed_idx
  on feedback_requests(status, completed_at desc)
  where status = 'completed' and analyzed_in_report_id is null;
