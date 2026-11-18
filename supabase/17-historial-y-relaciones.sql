-- Historial de archivos (RF-06), historial de reclasificaciones (RF-32), CFDI relacionados (S2-07)
-- y régimen del receptor (RF-28). Ejecutar después de 16-aprobacion-clasificacion.sql.
-- Se puede volver a ejecutar sin problema. Las filas las escribe el servidor con la clave de servicio.

begin;

create table if not exists public.archivo_historial (
  id          uuid primary key default gen_random_uuid(),
  archivo_id  uuid not null references public.archivo (id) on delete cascade,
  estado      public.estado_archivo not null,
  motivo      text,
  ocurrido_en timestamptz not null default now()
);
alter table public.archivo_historial enable row level security;
drop policy if exists "ver" on public.archivo_historial;
create policy "ver" on public.archivo_historial for select to authenticated
  using (exists (select 1 from public.archivo a where a.id = archivo_id) and public.es_personal());

create table if not exists public.clasificacion_historial (
  id                 uuid primary key default gen_random_uuid(),
  concepto_id        uuid not null references public.concepto (id) on delete cascade,
  categoria_anterior text,
  categoria_nueva    text not null,
  cambiado_por       uuid references public.usuario (id),
  cambiado_en        timestamptz not null default now()
);
alter table public.clasificacion_historial enable row level security;
drop policy if exists "ver" on public.clasificacion_historial;
create policy "ver" on public.clasificacion_historial for select to authenticated
  using (exists (select 1 from public.concepto c where c.id = concepto_id) and public.es_personal());

create table if not exists public.factura_relacion (
  factura_id             uuid not null references public.factura (id) on delete cascade,
  tipo_relacion          varchar(2) not null,
  uuid_relacionado       varchar(36) not null,
  factura_relacionada_id uuid references public.factura (id) on delete set null,
  primary key (factura_id, tipo_relacion, uuid_relacionado)
);
alter table public.factura_relacion enable row level security;
drop policy if exists "ver" on public.factura_relacion;
create policy "ver" on public.factura_relacion for select to authenticated
  using (exists (select 1 from public.factura f where f.id = factura_id) and public.es_personal());

alter table public.factura add column if not exists regimen_receptor varchar(3);

-- Una categoría de cliente solo puede ligarse a un cliente del mismo despacho (RF-29).
drop policy if exists "crear" on public.categoria;
create policy "crear" on public.categoria for insert to authenticated
  with check (
    despacho_id = public.mi_despacho() and public.es_decisor()
    and (cliente_id is null or exists (
      select 1 from public.clientes c where c.id = cliente_id and c.despacho_id = public.mi_despacho()))
  );

commit;
