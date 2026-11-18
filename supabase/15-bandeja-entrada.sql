-- Bandeja de entrada (RF-01): archivos subidos sin cliente, que quedan en el despacho hasta asignarse.
-- Ejecutar después de 14-clave-enlace.sql. Se puede volver a ejecutar sin problema.

begin;

-- Todo archivo pertenece a un despacho; el cliente puede faltar mientras no coincida el RFC.
alter table public.archivo add column if not exists despacho_id uuid references public.despacho (id);
update public.archivo a set despacho_id = c.despacho_id
  from public.clientes c
  where c.id = a.cliente_id and a.despacho_id is null;

alter table public.archivo alter column cliente_id drop not null;

alter table public.archivo drop constraint if exists archivo_destino_check;
alter table public.archivo add constraint archivo_destino_check
  check (cliente_id is not null or despacho_id is not null);

alter table public.archivo drop constraint if exists archivo_origen_check;
alter table public.archivo add constraint archivo_origen_check
  check (origen in ('manual', 'enlace', 'entrada'));

-- Ver: los de un cliente como antes; los de la bandeja, cualquier persona del despacho.
drop policy if exists "ver" on public.archivo;
create policy "ver" on public.archivo for select to authenticated
  using (
    ((cliente_id is not null and public.cliente_es_mio(cliente_id))
     or (cliente_id is null and despacho_id = public.mi_despacho()))
    and public.es_personal()
  );

commit;
