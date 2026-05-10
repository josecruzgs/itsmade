-- =============================================================================
-- itsMade — Auth + Roles
-- Tabla profiles ligada a auth.users con role (admin | user) y RLS.
--
-- (Copia adaptada del patrón probado en producción de TomaLab.)
-- =============================================================================

-- Role enum
do $$ begin
  create type user_role as enum ('admin', 'user');
exception
  when duplicate_object then null;
end $$;

-- Tabla profiles
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        user_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles(role);

-- Trigger updated_at
create or replace function profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at_trigger on profiles;
create trigger profiles_updated_at_trigger
  before update on profiles
  for each row execute function profiles_set_updated_at();

-- =============================================================================
-- Helper: is_admin() — usado por las RLS policies
-- =============================================================================
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated;

-- =============================================================================
-- Trigger: al crear un usuario en auth.users, crear su profile en public.profiles
-- =============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  initial_role user_role;
begin
  -- El primer usuario creado siempre es admin (bootstrap).
  -- Los siguientes son 'user' por defecto.
  if not exists (select 1 from public.profiles) then
    initial_role := 'admin';
  else
    initial_role := 'user';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, initial_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- RLS policies (solo en profiles; data tables siguen sin RLS en MVP)
-- =============================================================================
alter table profiles enable row level security;

drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_admin_select on profiles;
create policy profiles_admin_select on profiles
  for select using (is_admin());

drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles
  for update using (is_admin());

drop policy if exists profiles_admin_insert on profiles;
create policy profiles_admin_insert on profiles
  for insert with check (is_admin());

drop policy if exists profiles_admin_delete on profiles;
create policy profiles_admin_delete on profiles
  for delete using (is_admin());

-- Permisos generales sobre la tabla
grant select, update on profiles to authenticated;
grant all on profiles to service_role;
