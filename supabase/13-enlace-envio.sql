-- Envío por enlace (RF-04): cada cliente tiene un enlace secreto para subir sus XML sin cuenta.
-- Ejecutar después de 12-regla-emisor.sql.

begin;

-- Token del enlace. Null = el cliente todavía no tiene enlace. Regenerarlo invalida el anterior.
alter table public.clientes add column enlace_token varchar(64) unique;

-- Los archivos que llegan por enlace no tienen usuario que los subió.
alter table public.archivo alter column subido_por drop not null;
alter table public.archivo add column origen varchar(10) not null default 'manual'
  check (origen in ('manual', 'enlace'));

commit;
