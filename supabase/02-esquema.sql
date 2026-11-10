-- Esquema base según docs/04-modelo-datos.md. Ejecutar en Supabase > SQL Editor, después de 01-clientes.sql.
-- La tabla clientes conserva su nombre en plural; 02 solo le agrega despacho_id.
-- La migración de sus datos y la reescritura de sus políticas es la tarea S1-02.

-- Tipos enumerados -------------------------------------------------------

create type public.rol_usuario as enum ('administrador', 'contador', 'auxiliar', 'cliente');
create type public.tipo_archivo as enum ('xml', 'pdf', 'imagen', 'zip');
create type public.estado_archivo as enum ('recibido', 'leyendo', 'por_revisar', 'clasificado', 'error');
create type public.relacion_factura as enum ('emitida', 'recibida');
create type public.estado_sat as enum ('vigente', 'cancelada', 'no_encontrada');
create type public.estado_revision as enum ('por_confirmar', 'por_revisar', 'clasificado', 'excluido');
create type public.tipo_impuesto as enum ('trasladado', 'retenido');
create type public.decision_sugerencia as enum ('pendiente', 'aceptada', 'corregida', 'rechazada');
create type public.estado_periodo as enum ('abierto', 'cerrado');
create type public.accion_bitacora as enum ('subio', 'corrigio', 'aprobo', 'exporto', 'cerro_periodo');

-- Tablas -----------------------------------------------------------------

create table public.despacho (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  rfc       varchar(13) not null unique,
  creado_en timestamptz not null default now()
);

create table public.usuario (
  id                uuid primary key references auth.users (id) on delete cascade,
  despacho_id       uuid not null references public.despacho (id),
  nombre            text not null,
  correo            text not null unique,
  rol               public.rol_usuario not null,
  activo            boolean not null default true,
  dos_pasos_activo  boolean not null default false  -- obligatorio para contador y administrador (RNF-09)
);

alter table public.clientes
  add column despacho_id     uuid references public.despacho (id),
  add column regimen_fiscal  varchar(3),
  add column activo          boolean not null default true;

create unique index clientes_despacho_rfc_idx on public.clientes (despacho_id, rfc);

create table public.archivo (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id),
  subido_por     uuid not null default auth.uid() references public.usuario (id),
  tipo           public.tipo_archivo not null,
  estado         public.estado_archivo not null default 'recibido',
  huella_sha256  varchar(64) not null,
  ruta_original  text not null,  -- el original nunca se modifica (RF-06)
  recibido_en    timestamptz not null default now(),
  unique (cliente_id, huella_sha256)
);

create table public.periodo (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id),
  mes_anio    varchar(7) not null check (mes_anio ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  estado      public.estado_periodo not null default 'abierto',
  cerrado_en  timestamptz,
  cerrado_por uuid references public.usuario (id),
  unique (cliente_id, mes_anio)
);

create table public.factura (
  id                  uuid primary key default gen_random_uuid(),
  archivo_id          uuid not null references public.archivo (id),
  cliente_id          uuid not null references public.clientes (id),
  periodo_id          uuid references public.periodo (id),
  uuid_fiscal         varchar(36) not null,
  tipo_comprobante    char(1) not null check (tipo_comprobante in ('I', 'E', 'T', 'P', 'N')),
  relacion            public.relacion_factura not null,
  rfc_emisor          varchar(13) not null,
  rfc_receptor        varchar(13) not null,
  uso_cfdi            varchar(4) not null,
  forma_pago          varchar(2),  -- los CFDI de pago y de nómina pueden no traerla
  metodo_pago         varchar(3) check (metodo_pago in ('PUE', 'PPD')),
  subtotal            numeric(14,2) not null,
  total               numeric(14,2) not null,
  moneda              varchar(3) not null default 'MXN',
  estado_sat          public.estado_sat not null,
  fecha_consulta_sat  timestamptz not null,
  estado_revision     public.estado_revision not null default 'por_revisar',
  motivo_exclusion    text,
  emitido_en          timestamptz not null,
  timbrado_en         timestamptz not null,
  unique (cliente_id, uuid_fiscal),
  check (estado_revision <> 'excluido' or motivo_exclusion is not null)  -- RF-40
);

create table public.categoria (
  id                 uuid primary key default gen_random_uuid(),
  despacho_id        uuid not null references public.despacho (id),
  cliente_id         uuid references public.clientes (id),  -- nulo: categoría del despacho (RF-29)
  nombre             text not null,
  deducible_default  boolean not null default true
);

create table public.concepto (
  id               uuid primary key default gen_random_uuid(),
  factura_id       uuid not null references public.factura (id) on delete cascade,
  clave_prod_serv  varchar(8) not null,
  descripcion      text not null,
  cantidad         numeric(12,4) not null,
  unidad           text,
  importe          numeric(14,2) not null,
  objeto_impuesto  varchar(2),
  categoria_id     uuid references public.categoria (id)
);

create table public.impuesto (
  id           uuid primary key default gen_random_uuid(),
  concepto_id  uuid not null references public.concepto (id) on delete cascade,
  tipo         public.tipo_impuesto not null,
  impuesto     varchar(10) not null,
  tasa         numeric(6,4) not null,
  importe      numeric(14,2) not null
);

create table public.regla (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes (id),
  condicion     jsonb not null,  -- ej. {"emisor_rfc": "XXX"} (RF-30)
  categoria_id  uuid not null references public.categoria (id),
  creada_por    uuid not null default auth.uid() references public.usuario (id),
  activa        boolean not null default true
);

create table public.sugerencia (
  id                  uuid primary key default gen_random_uuid(),
  factura_id          uuid not null references public.factura (id) on delete cascade,
  modelo              text not null,
  version_modelo      text not null,
  confianza           numeric(5,2) not null check (confianza between 0 and 100),
  categoria_sugerida  text not null,
  explicacion         text not null,
  decision            public.decision_sugerencia not null default 'pendiente',
  decidida_por        uuid references public.usuario (id),
  decidida_en         timestamptz
);

create table public.bitacora (
  id           uuid primary key default gen_random_uuid(),
  factura_id   uuid references public.factura (id),
  usuario_id   uuid not null default auth.uid() references public.usuario (id),
  accion       public.accion_bitacora not null,
  detalle      jsonb,
  ocurrido_en  timestamptz not null default now()
);

create index on public.archivo (cliente_id, estado);
create index on public.factura (cliente_id, estado_revision);
create index on public.factura (archivo_id);
create index on public.concepto (factura_id);
create index on public.impuesto (concepto_id);
create index on public.categoria (despacho_id);
create index on public.regla (cliente_id);
create index on public.usuario (despacho_id);
create index on public.bitacora (usuario_id);

-- Funciones de apoyo para las políticas ----------------------------------
-- Son security definer para poder consultar usuario y clientes sin que las
-- políticas se llamen a sí mismas.

-- Despacho del usuario en sesión. Es nulo si está inactivo o tiene rol cliente:
-- el acceso del rol cliente se define en la tarea S4-06.
create function public.mi_despacho() returns uuid
language sql stable security definer set search_path = '' as $$
  select despacho_id from public.usuario
  where id = auth.uid() and activo and rol <> 'cliente'
$$;

create function public.mi_rol() returns public.rol_usuario
language sql stable security definer set search_path = '' as $$
  select rol from public.usuario where id = auth.uid() and activo
$$;

create function public.cliente_es_mio(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clientes
    where id = cid and despacho_id is not null and despacho_id = public.mi_despacho()
  )
$$;

create function public.factura_es_mia(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.factura f
    where f.id = fid and public.cliente_es_mio(f.cliente_id)
  )
$$;

create function public.concepto_es_mio(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.concepto c
    where c.id = cid and public.factura_es_mia(c.factura_id)
  )
$$;

revoke execute on function
  public.mi_despacho(), public.mi_rol(), public.cliente_es_mio(uuid),
  public.factura_es_mia(uuid), public.concepto_es_mio(uuid)
from public, anon;
grant execute on function
  public.mi_despacho(), public.mi_rol(), public.cliente_es_mio(uuid),
  public.factura_es_mia(uuid), public.concepto_es_mio(uuid)
to authenticated;

-- Seguridad por fila (RNF-08) --------------------------------------------
-- Por ahora cada tabla se aísla por despacho. Los permisos por rol dentro del
-- despacho se refinan en la tarea S1-04.

alter table public.despacho   enable row level security;
alter table public.usuario    enable row level security;
alter table public.archivo    enable row level security;
alter table public.periodo    enable row level security;
alter table public.factura    enable row level security;
alter table public.categoria  enable row level security;
alter table public.concepto   enable row level security;
alter table public.impuesto   enable row level security;
alter table public.regla      enable row level security;
alter table public.sugerencia enable row level security;
alter table public.bitacora   enable row level security;

create policy "ver mi despacho" on public.despacho
  for select to authenticated using (id = public.mi_despacho());
create policy "editar mi despacho" on public.despacho
  for update to authenticated
  using (id = public.mi_despacho() and public.mi_rol() = 'administrador')
  with check (id = public.mi_despacho());

create policy "ver usuarios del despacho" on public.usuario
  for select to authenticated
  using (id = auth.uid() or despacho_id = public.mi_despacho());
create policy "administrar usuarios" on public.usuario
  for all to authenticated
  using (despacho_id = public.mi_despacho() and public.mi_rol() = 'administrador')
  with check (despacho_id = public.mi_despacho() and public.mi_rol() = 'administrador');

create policy "mi despacho" on public.archivo
  for all to authenticated
  using (public.cliente_es_mio(cliente_id)) with check (public.cliente_es_mio(cliente_id));
create policy "mi despacho" on public.periodo
  for all to authenticated
  using (public.cliente_es_mio(cliente_id)) with check (public.cliente_es_mio(cliente_id));
create policy "mi despacho" on public.factura
  for all to authenticated
  using (public.cliente_es_mio(cliente_id)) with check (public.cliente_es_mio(cliente_id));
create policy "mi despacho" on public.regla
  for all to authenticated
  using (public.cliente_es_mio(cliente_id)) with check (public.cliente_es_mio(cliente_id));
create policy "mi despacho" on public.categoria
  for all to authenticated
  using (despacho_id = public.mi_despacho()) with check (despacho_id = public.mi_despacho());
create policy "mi despacho" on public.concepto
  for all to authenticated
  using (public.factura_es_mia(factura_id)) with check (public.factura_es_mia(factura_id));
create policy "mi despacho" on public.impuesto
  for all to authenticated
  using (public.concepto_es_mio(concepto_id)) with check (public.concepto_es_mio(concepto_id));
create policy "mi despacho" on public.sugerencia
  for all to authenticated
  using (public.factura_es_mia(factura_id)) with check (public.factura_es_mia(factura_id));

-- Bitácora: solo se inserta y se consulta (RNF-22). Únicamente el administrador la lee.
create policy "registrar acciones propias" on public.bitacora
  for insert to authenticated
  with check (usuario_id = auth.uid() and public.mi_despacho() is not null);
create policy "administrador consulta la bitacora" on public.bitacora
  for select to authenticated
  using (
    public.mi_rol() = 'administrador'
    and exists (
      select 1 from public.usuario u
      where u.id = usuario_id and u.despacho_id = public.mi_despacho()
    )
  );
revoke update, delete, truncate on public.bitacora from anon, authenticated;

-- Datos iniciales --------------------------------------------------------
-- Hasta la tarea S1-03, el primer despacho y su administrador se crean a mano
-- (el editor SQL no pasa por RLS). Ejemplo, con el correo de un usuario ya
-- creado en Authentication > Users:
--
-- with d as (
--   insert into public.despacho (nombre, rfc) values ('Nombre del despacho', 'RFC DEL DESPACHO') returning id
-- )
-- insert into public.usuario (id, despacho_id, nombre, correo, rol)
-- select u.id, d.id, 'Nombre', u.email, 'administrador' from auth.users u, d where u.email = 'correo@ejemplo.mx';
