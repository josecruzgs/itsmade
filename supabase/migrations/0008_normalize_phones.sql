-- =============================================================================
-- itsMade — Normalizar telefonos de WhatsApp al formato canonico 521+10.
--
-- Antes era ad hoc: la API/webhook guardaban "5216861234567" (formato Evolution),
-- pero el panel admin podia guardar "6861234567" o "526861234567". Esto causaba
-- duplicados en `customers` cuando un cliente que ya existia (con un formato)
-- entraba por intake (con otro formato).
--
-- Esta migracion:
--   1. Normaliza customers.whatsapp_phone a "521" + 10 digitos.
--   2. Normaliza employees.whatsapp_phone igual.
--   3. Normaliza service_intake_requests.requested_phone igual.
--   4. Normaliza conversations.whatsapp_phone igual.
--
-- Ambas tablas con UNIQUE (customers, employees) usan logica defensiva:
-- si normalizar generaria una colision con otro registro existente, la fila
-- se DEJA SIN TOCAR y se reporta via NOTICE en los logs. El admin debe
-- mergearlos manualmente despues.
--
-- Idempotente: corriendo dos veces no hace nada en la segunda.
-- =============================================================================

do $$
declare
  r record;
  normalized text;
  collision boolean;
  tbl text;
  unique_tables text[] := array['customers', 'employees'];
begin
  -- Tablas con UNIQUE: customers + employees
  foreach tbl in array unique_tables loop
    for r in execute format(
      'select id, whatsapp_phone from %I where whatsapp_phone !~ ''^521[0-9]{10}$''',
      tbl
    ) loop
      normalized := case
        when r.whatsapp_phone ~ '^52[0-9]{10}$' then '521' || substring(r.whatsapp_phone from 3)
        when r.whatsapp_phone ~ '^[0-9]{10}$' then '521' || r.whatsapp_phone
        else null
      end;

      if normalized is null then
        raise notice '[%] id=% whatsapp no normalizable: %', tbl, r.id, r.whatsapp_phone;
        continue;
      end if;

      execute format(
        'select exists(select 1 from %I where whatsapp_phone = $1 and id <> $2)',
        tbl
      ) into collision using normalized, r.id;

      if collision then
        raise notice '[%] id=% colision al normalizar (% -> %), saltado',
          tbl, r.id, r.whatsapp_phone, normalized;
      else
        execute format('update %I set whatsapp_phone = $1 where id = $2', tbl)
          using normalized, r.id;
      end if;
    end loop;
  end loop;
end $$;

-- service_intake_requests.requested_phone (no es UNIQUE, update directo).
update service_intake_requests
set requested_phone = case
  when requested_phone ~ '^521[0-9]{10}$' then requested_phone
  when requested_phone ~ '^52[0-9]{10}$' then '521' || substring(requested_phone from 3)
  when requested_phone ~ '^[0-9]{10}$' then '521' || requested_phone
  else requested_phone
end
where requested_phone !~ '^521[0-9]{10}$';

-- conversations.whatsapp_phone (no es UNIQUE). En teoria todas vienen del
-- webhook ya en formato canonico, pero normalizamos por defensa en profundidad.
update conversations
set whatsapp_phone = case
  when whatsapp_phone ~ '^521[0-9]{10}$' then whatsapp_phone
  when whatsapp_phone ~ '^52[0-9]{10}$' then '521' || substring(whatsapp_phone from 3)
  when whatsapp_phone ~ '^[0-9]{10}$' then '521' || whatsapp_phone
  else whatsapp_phone
end
where whatsapp_phone !~ '^521[0-9]{10}$';
