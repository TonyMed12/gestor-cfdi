-- Deducibilidad por factura (A7): el contador puede marcar una factura recibida como deducible o no deducible.
-- Esa marca gana sobre la de la categoría (categoria.deducible_default) en el IVA acreditable y en las deducciones.
--   null  = según la categoría de cada concepto (lo que pasa hoy)
--   true  = toda la factura es deducible
--   false = toda la factura es no deducible
-- Solo aplica a facturas recibidas (gastos): una emitida es un ingreso y no se deduce.
-- Quién la cambia: administrador y contador (política "editar" de factura, 04-permisos-por-rol.sql).
-- Ejecutar después de 20-periodos.sql. Se puede volver a ejecutar sin problema.

begin;

alter table public.factura add column if not exists deducible boolean;

alter table public.factura drop constraint if exists factura_deducible_solo_recibidas;
alter table public.factura add constraint factura_deducible_solo_recibidas
  check (deducible is null or relacion = 'recibida');

comment on column public.factura.deducible is
  'A7: null = según la categoría de cada concepto; true o false = marca del contador para toda la factura (solo recibidas).';

commit;

-- Comprobación (opcional, solo lectura): todas las facturas existentes quedan en null (según la categoría).
--   select deducible, count(*) from public.factura group by 1;
