-- Envío por enlace (RF-04), parte 1: columnas para archivos que llegan por enlace.
-- Ejecutar después de 12-regla-emisor.sql. Se puede volver a ejecutar sin problema.

begin;

-- Los archivos que llegan por enlace no tienen usuario que los subió.
alter table public.archivo alter column subido_por drop not null;
alter table public.archivo add column if not exists origen varchar(10) not null default 'manual';
alter table public.archivo drop constraint if exists archivo_origen_check;
alter table public.archivo add constraint archivo_origen_check check (origen in ('manual', 'enlace'));

-- Columna temporal del token (14 la mueve a su tabla y la quita).
alter table public.clientes add column if not exists enlace_token varchar(64) unique;

commit;
