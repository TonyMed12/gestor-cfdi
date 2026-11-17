-- Lista inicial de categorías de cada despacho (RF-29). Son de nivel despacho (cliente_id nulo).
-- El contador puede editarlas o crear otras desde /categorias.
-- Idempotente: si un despacho ya tiene una categoría con ese nombre, no la duplica.
-- Ejecutar después de 04-permisos-por-rol.sql.

begin;

insert into public.categoria (despacho_id, nombre, deducible_default)
select d.id, v.nombre, v.deducible
from public.despacho d
cross join (values
  ('Ventas de bienes',                 true),
  ('Servicios prestados',              true),
  ('Otros ingresos',                   true),
  ('Compras de mercancía o insumos',   true),
  ('Gastos de oficina y papelería',    true),
  ('Honorarios y servicios profesionales', true),
  ('Renta de local o equipo',          true),
  ('Servicios (luz, agua, internet, teléfono)', true),
  ('Combustible, viáticos y transporte', true),
  ('Publicidad y marketing',           true),
  ('Mantenimiento y reparaciones',     true),
  ('Equipo de cómputo y software',     true),
  ('Seguros',                          true),
  ('Comisiones bancarias',             true),
  ('Gastos no deducibles',             false)
) as v(nombre, deducible)
where not exists (
  select 1 from public.categoria c
  where c.despacho_id = d.id and c.cliente_id is null and c.nombre = v.nombre
);

commit;
