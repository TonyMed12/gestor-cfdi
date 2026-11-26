-- Categorías propias de cada cliente (H3, RF-29): solo aparecen en las facturas de su cliente y no se mezclan con las
-- del despacho.
--
-- Antes de este script (lo encontró pruebas/categorias-cliente.test.mjs):
--   1) Una clave del SAT o una regla por emisor podía apuntar a una categoría de un cliente. Esas reglas aplican a
--      todos los clientes del despacho, así que la categoría de un cliente habría llegado a las facturas de otros.
--      La pantalla no lo ofrecía, pero la base lo aceptaba.
--   2) Una categoría de cliente podía llamarse igual que una del despacho (en la base real: «Servicios prestados» de
--      José Antonio). En la revisión salían dos opciones iguales, y como la clasificación se busca por nombre,
--      podía elegirse la que no era.
--
-- Este script:
--   1) Claves del SAT y reglas por emisor: solo categorías del despacho (cliente_id nulo). Y el concepto de una factura:
--      solo del despacho o del cliente de esa factura. Políticas restrictivas: se suman a las que ya existen.
--   2) No se permiten dos categorías con el mismo nombre (sin importar mayúsculas ni espacios) que un mismo cliente vea:
--      una del despacho y una de cliente, o dos del mismo cliente. Solo revisa lo que se crea o se edita desde ahora;
--      lo que ya existe no se toca (abajo hay una consulta para renombrarlo).
--
-- Ejecutar después de 25-limite-enlace-por-ip.sql. Se puede volver a ejecutar sin problema.

begin;

-- 1) Las reglas de todo el despacho solo usan categorías del despacho.
drop policy if exists "categoria del despacho, no de un cliente" on public.clave_categoria;
create policy "categoria del despacho, no de un cliente" on public.clave_categoria
  as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.categoria c where c.id = categoria_id and c.cliente_id is null));

drop policy if exists "categoria del despacho, no de un cliente" on public.regla_emisor;
create policy "categoria del despacho, no de un cliente" on public.regla_emisor
  as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.categoria c where c.id = categoria_id and c.cliente_id is null));

-- 1b) El concepto de una factura solo lleva una categoría del despacho o la propia del cliente de esa factura
--     (antes aceptaba la de otro cliente del mismo despacho; la aplicación ya lo revisaba al aprobar).
drop policy if exists "categoria del despacho o de su cliente" on public.concepto;
create policy "categoria del despacho o de su cliente" on public.concepto
  as restrictive for all to authenticated
  using (true)
  with check (
    categoria_id is null or exists (
      select 1 from public.categoria c join public.factura f on f.id = factura_id
      where c.id = categoria_id and (c.cliente_id is null or c.cliente_id = f.cliente_id))
  );

-- 2) Sin nombres repetidos que un mismo cliente vea.
create or replace function public.categoria_nombre_unico() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.categoria otra
    where otra.despacho_id = new.despacho_id
      and otra.id <> new.id
      and lower(btrim(otra.nombre)) = lower(btrim(new.nombre))
      and (otra.cliente_id is null or new.cliente_id is null or otra.cliente_id = new.cliente_id)
  ) then
    raise exception 'Ya existe una categoría con el nombre «%» para este cliente o para todo el despacho.', btrim(new.nombre)
      using errcode = 'CT001';
  end if;
  return new;
end $$;
revoke execute on function public.categoria_nombre_unico() from public, anon, authenticated;

drop trigger if exists categoria_nombre_unico on public.categoria;
create trigger categoria_nombre_unico
  before insert or update of nombre, cliente_id, despacho_id on public.categoria
  for each row execute function public.categoria_nombre_unico();

commit;

-- Comprobación (opcional, solo lectura): categorías de cliente que se llaman igual que una del despacho.
--   select c.nombre, cl.razon_social from public.categoria c join public.clientes cl on cl.id = c.cliente_id
--   where exists (select 1 from public.categoria d where d.despacho_id = c.despacho_id and d.cliente_id is null
--                 and lower(btrim(d.nombre)) = lower(btrim(c.nombre)));
--
-- Para renombrar la que ya existe (no la usa ninguna factura), por ejemplo:
--   update public.categoria set nombre = 'Servicios prestados (José Antonio)'
--   where cliente_id is not null and nombre = 'Servicios prestados';
