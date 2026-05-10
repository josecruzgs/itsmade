-- =============================================================================
-- itsMade — Seed inicial
-- 3 sucursales reales + 3 categorías + 12 servicios placeholders.
-- Los nombres y precios son tentativos; se editan desde /catalog y /branches.
-- =============================================================================

-- Sucursales
insert into branches (name, city, state, phone, active) values
  ('itsMade Tijuana',     'Tijuana',     'Baja California', null, true),
  ('itsMade Guadalajara', 'Guadalajara', 'Jalisco',         null, true),
  ('itsMade Monterrey',   'Monterrey',   'Nuevo León',      null, true)
on conflict do nothing;

-- Categorías
insert into service_categories (slug, name, description) values
  ('residencial', 'Limpieza Residencial',
   'Servicios de limpieza para casas, departamentos, post-mudanza y post-obra.'),
  ('comercial',   'Limpieza Comercial',
   'Servicios de limpieza para oficinas, locales, consultorios y espacios de trabajo.'),
  ('industrial',  'Limpieza Industrial',
   'Servicios de limpieza para naves, almacenes, plantas de producción y tanques.')
on conflict (slug) do nothing;

-- Servicios — 4 por categoría
with cats as (
  select id, slug from service_categories
)
insert into services (code, name, category_id, description, base_price_mxn, active)
select v.code, v.name, c.id, v.description, v.base_price_mxn, true
from (
  values
    -- Residencial
    ('RES-CASA-STD',  'Limpieza de casa estándar',
     'Limpieza general de casa habitada (cocina, baños, recámaras, áreas comunes).',
     1200.00),
    ('RES-DEPTO-STD', 'Limpieza de departamento estándar',
     'Limpieza general de departamento habitado.',
     900.00),
    ('RES-MUDANZA',   'Limpieza post-mudanza',
     'Limpieza profunda de inmueble desocupado tras mudanza (ventanas, gabinetes, baños).',
     2500.00),
    ('RES-OBRA',      'Limpieza post-obra residencial',
     'Limpieza tras obra o remodelación residencial (escombro fino, residuos de pintura).',
     3500.00),

    -- Comercial
    ('COM-OFI-STD',   'Limpieza de oficina (única vez)',
     'Limpieza única de oficinas, salas de juntas y áreas comunes.',
     1800.00),
    ('COM-OFI-MENS',  'Limpieza de oficina mensual',
     'Plan mensual de limpieza recurrente para oficinas (4 visitas/mes).',
     6000.00),
    ('COM-LOC-STD',   'Limpieza de local comercial',
     'Limpieza de local comercial al cierre o apertura.',
     1500.00),
    ('COM-CONS',      'Limpieza de consultorio médico',
     'Limpieza con protocolo sanitizante para consultorios y clínicas.',
     2000.00),

    -- Industrial
    ('IND-NAV-STD',   'Limpieza de nave industrial',
     'Limpieza general de nave industrial (pisos, oficinas internas, baños de personal).',
     8000.00),
    ('IND-ALM-STD',   'Limpieza de almacén',
     'Limpieza de almacenes y centros de distribución.',
     6500.00),
    ('IND-PLANTA',    'Limpieza de planta de producción',
     'Limpieza profunda de área de producción con protocolos industriales.',
     12000.00),
    ('IND-TANQUES',   'Limpieza de tanques y depósitos',
     'Limpieza especializada de tanques y depósitos (requiere cotización en sitio).',
     null)
) as v(code, name, description, base_price_mxn)
join cats c on c.slug = case
  when v.code like 'RES-%' then 'residencial'
  when v.code like 'COM-%' then 'comercial'
  when v.code like 'IND-%' then 'industrial'
end
on conflict (code) do nothing;
