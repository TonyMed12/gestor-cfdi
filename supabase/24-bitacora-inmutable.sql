-- Bitácora inmutable (G5, RNF-22, S1-05): nadie, ni los usuarios ni el servidor, modifica ni borra la bitácora.
--
-- Antes de este script (lo encontró pruebas/bitacora-inmutable.test.mjs):
--   - Los usuarios ya no podían modificar ni borrar (02-esquema.sql les quitó el permiso), pero la clave de servicio
--     del servidor sí podía cambiar cualquier registro o vaciar la tabla.
--   - La fecha de un registro nuevo la mandaba quien lo escribía: se podía fechar en el pasado o en el futuro. Con una
--     fecha futura, un motivo de periodo cerrado (D4, script 22) valía para siempre.
--
-- Este script:
--   1) Rechaza cualquier UPDATE, DELETE o TRUNCATE de la bitácora, venga de quien venga (error BT001), con triggers.
--      También quita esos permisos a la clave de servicio.
--   2) Al registrar, la base pone la fecha (ahora) y, si hay sesión, el autor (quien está en sesión).
-- Lo que no cambia: registrar acciones (insert) y que solo el administrador consulte la bitácora.
--
-- Ejecutar después de 23-aislamiento.sql. Se puede volver a ejecutar sin problema.
-- Nota: supabase/99-limpiar-pruebas.sql modifica la bitácora; después de este script falla en ese paso, a propósito.

begin;

-- 1) Nadie modifica ni borra.
create or replace function public.bitacora_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'La bitácora no se puede modificar ni borrar (RNF-22).' using errcode = 'BT001';
end $$;
revoke execute on function public.bitacora_inmutable() from public, anon, authenticated;

drop trigger if exists bitacora_sin_cambios on public.bitacora;
create trigger bitacora_sin_cambios
  before update or delete on public.bitacora
  for each row execute function public.bitacora_inmutable();

drop trigger if exists bitacora_sin_vaciar on public.bitacora;
create trigger bitacora_sin_vaciar
  before truncate on public.bitacora
  for each statement execute function public.bitacora_inmutable();

revoke update, delete, truncate on public.bitacora from anon, authenticated, service_role;

-- 2) La fecha y el autor los pone la base.
create or replace function public.bitacora_sellar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.ocurrido_en := now();
  if auth.uid() is not null then
    new.usuario_id := auth.uid();
  end if;
  return new;
end $$;
revoke execute on function public.bitacora_sellar() from public, anon, authenticated;

drop trigger if exists bitacora_sellar on public.bitacora;
create trigger bitacora_sellar
  before insert on public.bitacora
  for each row execute function public.bitacora_sellar();

commit;

-- Comprobación (opcional, solo lectura): registros con fecha futura de antes de este script. Debe salir 0.
--   select count(*) from public.bitacora where ocurrido_en > now();
