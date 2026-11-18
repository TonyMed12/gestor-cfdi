-- LIMPIEZA DE PRUEBAS. Borra facturas y archivos de TODOS los clientes del despacho en la base.
-- NO ejecutar en una base con clientes reales. Irreversible.
-- Antes de ejecutar: confirmar que esta base es de prueba, y decidir qué pasa con la bitácora
-- (ver el paso 2). Ejecutar en el SQL Editor de Supabase, que corre como propietario y salta RLS.

begin;

-- 1) Historiales y relaciones que cuelgan de facturas y archivos.
delete from public.clasificacion_historial;
delete from public.factura_relacion;
delete from public.archivo_historial;

-- 2) Bitácora: su vínculo a facturas (bitacora.factura_id) bloquea el borrado.
--    Opción A (conservar la bitácora): quitar el vínculo; los registros quedan sin factura.
update public.bitacora set factura_id = null where factura_id is not null;
--    Opción B (borrar también la bitácora): descomentar la línea siguiente y quitar la de arriba.
-- delete from public.bitacora;

-- 3) Facturas (sus conceptos, impuestos y sugerencias se borran en cascada).
delete from public.factura;

-- 4) Archivos del repositorio y de la bandeja de entrada.
delete from public.archivo;

-- 5) Los archivos guardados en el almacenamiento (bucket "facturas") NO se borran por SQL: Supabase lo bloquea.
--    Hay que borrarlos en Storage > facturas (ver instrucciones en el chat), después de ejecutar este script.

commit;
