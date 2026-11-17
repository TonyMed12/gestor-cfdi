-- Reglas por emisor: "todas las facturas de este RFC van a esta categoría" (S3-05).
-- La contraparte es el emisor en recibidas y el receptor en emitidas.
-- No hay triggers: la regla se aplica al leer, así que cubre también las facturas que ya existen.
-- Ejecutar después de 04-permisos-por-rol.sql y 10-categorias-iniciales.sql.

begin;

create table public.regla_emisor (
  despacho_id  uuid not null references public.despacho (id),
  rfc          varchar(13) not null,
  categoria_id uuid not null references public.categoria (id) on delete cascade,
  primary key (despacho_id, rfc)
);

alter table public.regla_emisor enable row level security;

-- Ver: cualquier persona del despacho. Cambiar: solo administrador y contador.
create policy "ver" on public.regla_emisor for select to authenticated
  using (despacho_id = public.mi_despacho() and public.es_personal());

create policy "crear" on public.regla_emisor for insert to authenticated
  with check (
    despacho_id = public.mi_despacho() and public.es_decisor()
    and exists (select 1 from public.categoria c
                where c.id = categoria_id and c.despacho_id = public.mi_despacho())
  );

create policy "editar" on public.regla_emisor for update to authenticated
  using (despacho_id = public.mi_despacho() and public.es_decisor())
  with check (
    despacho_id = public.mi_despacho()
    and exists (select 1 from public.categoria c
                where c.id = categoria_id and c.despacho_id = public.mi_despacho())
  );

create policy "borrar" on public.regla_emisor for delete to authenticated
  using (despacho_id = public.mi_despacho() and public.es_decisor());

commit;
