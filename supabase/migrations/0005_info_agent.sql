-- =============================================================================
-- itsMade — Agente 'info' (concierge / preguntas generales).
--
-- Antes: solo existia agent_type='feedback'. Si un cliente escribia sin
-- feedback request abierto, el bot quedaba en silencio (cold contact).
--
-- Ahora: agregamos agent_type='info' para responder dudas generales sobre la
-- empresa (servicios, horarios, sucursales, precios, agendar). El default
-- de conversaciones nuevas pasa de 'feedback' a 'info' — cuando un admin
-- dispara "Solicitar feedback", el server action sobreescribe a 'feedback'.
--
-- Backfill: las conversaciones existentes que estan en 'feedback' pero no
-- tienen feedback_request_id en su state (cold contacts viejos) pasan a 'info'.
-- =============================================================================

alter table conversations drop constraint conversations_agent_type_check;
alter table conversations add constraint conversations_agent_type_check
  check (agent_type in ('feedback', 'info'));

alter table conversations alter column agent_type set default 'info';

update conversations
   set agent_type = 'info'
 where agent_type = 'feedback'
   and not (state ? 'feedback_request_id');
