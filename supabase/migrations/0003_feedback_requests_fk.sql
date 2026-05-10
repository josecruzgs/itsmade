-- =============================================================================
-- FK que faltaba en 0001 (no podíamos ponerla antes porque profiles no existía).
-- =============================================================================

alter table feedback_requests
  drop constraint if exists feedback_requests_requested_by_fk;

alter table feedback_requests
  add constraint feedback_requests_requested_by_fk
  foreign key (requested_by_profile_id)
  references profiles(id)
  on delete set null;

create index if not exists feedback_requests_requested_by_idx
  on feedback_requests(requested_by_profile_id)
  where requested_by_profile_id is not null;
