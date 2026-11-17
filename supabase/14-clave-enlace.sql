-- Contraseña temporal para el enlace de envío (RF-04). Ejecutar después de 13-enlace-envio.sql.
-- El token y el hash de la contraseña viven aquí, en una tabla sin políticas: ningún usuario
-- (ni siquiera administrador o auxiliar) puede leerlos; solo el servidor con la clave de servicio.

begin;

create table if not exists public.enlace_acceso (
  cliente_id        uuid primary key references public.clientes (id) on delete cascade,
  token             varchar(64) not null unique,
  password_hash     text,                 -- null = enlace viejo sin contraseña: hay que regenerarlo
  vence_en          timestamptz not null,
  intentos_fallidos integer not null default 0,
  bloqueado_hasta   timestamptz
);

alter table public.enlace_acceso enable row level security;
-- Sin políticas a propósito: authenticated y anon no pueden leer ni escribir.

-- Mueve los tokens de 13 (si existen) y quita la columna que los exponía a todo el despacho.
-- Esos enlaces quedan sin contraseña y no abren nada hasta que el contador genere uno nuevo.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'clientes' and column_name = 'enlace_token') then
    insert into public.enlace_acceso (cliente_id, token, vence_en)
      select id, enlace_token, now() where enlace_token is not null
      on conflict (cliente_id) do nothing;
    alter table public.clientes drop column enlace_token;
  end if;
end $$;

commit;
