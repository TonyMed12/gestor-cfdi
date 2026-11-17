-- Mapeo por despacho: cada clave del SAT se asigna a una categoría del despacho (S3-02).
-- Ejemplo: 81111500 (Ingeniería de software) -> "Equipo de cómputo y software".
-- Ejecutar después de 04-permisos-por-rol.sql, 06-catalogos-sat.sql y 10-categorias-iniciales.sql.

begin;

create table public.clave_categoria (
  despacho_id  uuid not null references public.despacho (id),
  clave        varchar(8) not null references public.cat_clave_prod_serv (clave),
  categoria_id uuid not null references public.categoria (id) on delete cascade,
  primary key (despacho_id, clave)
);

alter table public.clave_categoria enable row level security;

-- Ver: cualquier persona del despacho. Cambiar: solo administrador y contador.
create policy "ver" on public.clave_categoria for select to authenticated
  using (despacho_id = public.mi_despacho() and public.es_personal());

create policy "crear" on public.clave_categoria for insert to authenticated
  with check (
    despacho_id = public.mi_despacho() and public.es_decisor()
    and exists (select 1 from public.categoria c
                where c.id = categoria_id and c.despacho_id = public.mi_despacho())
  );

create policy "editar" on public.clave_categoria for update to authenticated
  using (despacho_id = public.mi_despacho() and public.es_decisor())
  with check (
    despacho_id = public.mi_despacho()
    and exists (select 1 from public.categoria c
                where c.id = categoria_id and c.despacho_id = public.mi_despacho())
  );

create policy "borrar" on public.clave_categoria for delete to authenticated
  using (despacho_id = public.mi_despacho() and public.es_decisor());

-- Al cambiar el mapeo, se actualizan los conceptos de facturas que ya existen en el despacho.
create function public.aplicar_clave_categoria() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.concepto c set categoria_id = null
    from public.factura f join public.clientes cl on cl.id = f.cliente_id
    where c.factura_id = f.id and cl.despacho_id = old.despacho_id
      and c.clave_prod_serv = old.clave and c.categoria_id = old.categoria_id;
    return old;
  end if;
  update public.concepto c set categoria_id = new.categoria_id
  from public.factura f join public.clientes cl on cl.id = f.cliente_id
  where c.factura_id = f.id and cl.despacho_id = new.despacho_id
    and c.clave_prod_serv = new.clave;
  return new;
end $$;

create trigger clave_categoria_cambio after insert or update on public.clave_categoria
for each row execute function public.aplicar_clave_categoria();

create trigger clave_categoria_borrado after delete on public.clave_categoria
for each row execute function public.aplicar_clave_categoria();

-- Al guardar un concepto nuevo (lectura de XML), toma la categoría del mapeo si existe.
create function public.asignar_categoria_concepto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.categoria_id is null then
    select cc.categoria_id into new.categoria_id
    from public.factura f
    join public.clientes cl on cl.id = f.cliente_id
    join public.clave_categoria cc on cc.despacho_id = cl.despacho_id and cc.clave = new.clave_prod_serv
    where f.id = new.factura_id;
  end if;
  return new;
end $$;

create trigger concepto_categoria before insert on public.concepto
for each row execute function public.asignar_categoria_concepto();

-- Claves distintas que aparecen en facturas. security_invoker: RLS de concepto aplica.
create view public.claves_en_uso with (security_invoker = true) as
  select distinct clave_prod_serv as clave from public.concepto;

commit;
