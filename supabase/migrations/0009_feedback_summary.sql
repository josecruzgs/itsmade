-- =============================================================================
-- itsMade — Resumen de la conversacion de feedback.
--
-- Agrega:
--   - feedback_requests.summary              → texto generado por el agente al finalizar.
--   - feedback_requests.summary_generated_at → timestamp de generacion (null si no hay).
--
-- Backfill: filas existentes quedan con summary=null. No se regenera retroactivamente.
--
-- Idempotente.
-- =============================================================================

alter table feedback_requests
  add column if not exists summary text;
alter table feedback_requests
  add column if not exists summary_generated_at timestamptz;
