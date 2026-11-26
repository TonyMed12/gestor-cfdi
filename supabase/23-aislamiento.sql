-- Aislamiento entre despachos (G1, RNF-08): cierra cuatro referencias cruzadas que encontró la prueba
-- pruebas/aislamiento.test.mjs. Con las políticas anteriores, una persona del despacho A podía:
--   1) escribir en la bitácora una fila sobre una factura del despacho B (cualquier rol);
--   2) poner en un concepto de A una categoría del despacho B (administrador y contador, al editar);
--   3) crear o editar una regla de un cliente de A con una categoría de B (administrador y contador);
--   4) ligar una categoría de A a un cliente de B al editarla (administrador y contador).
-- Nadie de A veía datos de B con esto, pero sí dejaba en A referencias a datos de B: por ejemplo, B ya no podía
-- borrar esa categoría, y la fila de bitácora contaba como motivo para cambiar una factura de B en un periodo cerrado.
--
-- Son políticas restrictivas: se suman a las que ya existen (no las reemplazan), así que dentro de un mismo despacho
-- todo funciona igual. La clave de servicio del servidor no pasa por RLS.
-- Ejecutar después de 22-cierre-de-periodo.sql. Se puede volver a ejecutar sin problema.

begin;

-- 1) Bitácora: la factura de la fila, si la hay, debe ser del despacho de quien escribe.
drop policy if exists "solo facturas de mi despacho" on public.bitacora;
create policy "solo facturas de mi despacho" on public.bitacora
  as restrictive for insert to authenticated
  with check (factura_id is null or public.factura_es_mia(factura_id));

-- 2) Conceptos: su categoría debe ser del despacho.
drop policy if exists "categoria de mi despacho" on public.concepto;
create policy "categoria de mi despacho" on public.concepto
  as restrictive for all to authenticated
  using (true)
  with check (
    categoria_id is null or exists (
      select 1 from public.categoria c where c.id = categoria_id and c.despacho_id = public.mi_despacho())
  );

-- 3) Reglas por cliente: su categoría debe ser del despacho (como ya pasa con clave_categoria y regla_emisor).
drop policy if exists "categoria de mi despacho" on public.regla;
create policy "categoria de mi despacho" on public.regla
  as restrictive for all to authenticated
  using (true)
  with check (
    exists (select 1 from public.categoria c where c.id = categoria_id and c.despacho_id = public.mi_despacho())
  );

-- 4) Categorías de cliente: al editar, el cliente debe seguir siendo del despacho (al crear ya se revisaba, script 17).
drop policy if exists "cliente de mi despacho" on public.categoria;
create policy "cliente de mi despacho" on public.categoria
  as restrictive for all to authenticated
  using (true)
  with check (
    cliente_id is null or exists (
      select 1 from public.clientes c where c.id = cliente_id and c.despacho_id = public.mi_despacho())
  );

commit;

-- Comprobación (opcional, solo lectura): referencias cruzadas que ya existieran antes de este script. Deben salir 0.
--   select count(*) from public.bitacora b join public.usuario u on u.id = b.usuario_id
--     join public.factura f on f.id = b.factura_id join public.clientes c on c.id = f.cliente_id
--     where c.despacho_id <> u.despacho_id;
--   select count(*) from public.concepto k join public.factura f on f.id = k.factura_id
--     join public.clientes c on c.id = f.cliente_id join public.categoria g on g.id = k.categoria_id
--     where g.despacho_id <> c.despacho_id;
--   select count(*) from public.regla r join public.clientes c on c.id = r.cliente_id
--     join public.categoria g on g.id = r.categoria_id where g.despacho_id <> c.despacho_id;
--   select count(*) from public.categoria g join public.clientes c on c.id = g.cliente_id
--     where g.despacho_id <> c.despacho_id;
