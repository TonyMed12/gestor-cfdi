-- Lo mínimo de Supabase para cargar los scripts de supabase/ en un Postgres de prueba (PGlite) y probar RLS (G1).
-- No es parte de la base real: solo lo usa pruebas/aislamiento.test.mjs.
--   - Roles de Supabase: anon (sin sesión), authenticated (con sesión) y service_role (clave de servicio, salta RLS).
--   - auth.uid(): el usuario de la sesión, igual que en Supabase (lo toma de request.jwt.claim.sub).
--   - storage: los buckets y los objetos (archivos), con RLS como en Supabase.
--   - Permisos por omisión de Supabase: anon y authenticated pueden usar todas las tablas de public; RLS decide.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
