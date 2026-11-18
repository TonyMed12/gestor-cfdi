-- Corrige el estado de los archivos de facturas que ya se aprobaron o rechazaron antes del cambio.
-- La vista de clientes cuenta por estado del archivo, y la aprobación solo cambiaba la factura.
-- Se puede volver a ejecutar sin problema.

begin;

update public.archivo a set estado = 'clasificado'
from public.factura f
where f.archivo_id = a.id and f.estado_revision = 'clasificado' and a.estado <> 'clasificado';

update public.archivo a set estado = 'error', motivo_error = coalesce(a.motivo_error, 'Rechazada: ' || coalesce(f.motivo_exclusion, 'sin motivo'))
from public.factura f
where f.archivo_id = a.id and f.estado_revision = 'excluido' and a.estado = 'por_revisar';

commit;
