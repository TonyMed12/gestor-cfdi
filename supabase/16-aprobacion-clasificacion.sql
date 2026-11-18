-- Aprobación de la clasificación (S3-08): al aprobar, la categoría de cada concepto queda fija.
-- Los cambios de claves ya no reclasifican facturas aprobadas; para cambiarlas se usa "Corregir".
-- Ejecutar después de 15-bandeja-entrada.sql. Se puede volver a ejecutar sin problema.

begin;

create or replace function public.aplicar_clave_categoria() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.concepto c set categoria_id = null
    from public.factura f join public.clientes cl on cl.id = f.cliente_id
    where c.factura_id = f.id and cl.despacho_id = old.despacho_id
      and c.clave_prod_serv = old.clave and c.categoria_id = old.categoria_id
      and f.estado_revision <> 'clasificado';
    return old;
  end if;
  update public.concepto c set categoria_id = new.categoria_id
  from public.factura f join public.clientes cl on cl.id = f.cliente_id
  where c.factura_id = f.id and cl.despacho_id = new.despacho_id
    and c.clave_prod_serv = new.clave
    and f.estado_revision <> 'clasificado';
  return new;
end $$;

commit;
