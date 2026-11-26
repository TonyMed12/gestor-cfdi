-- Límite por dirección IP en el enlace del cliente (G6). Además del bloqueo por enlace (5 intentos, 15 minutos),
-- una misma conexión no puede probar contraseñas sin límite en muchos enlaces: 10 intentos fallidos en 15 minutos.
--
-- Cada intento fallido se guarda aquí con una huella de la IP (HMAC; no se guarda la IP) y su hora. Lo escribe y lo lee
-- solo el servidor con la clave de servicio: sin políticas, ningún usuario (ni sin sesión) puede leerla ni escribirla,
-- igual que enlace_acceso (14-clave-enlace.sql). Los intentos de más de un día se borran al registrar uno nuevo.
--
-- Ejecutar después de 24-bitacora-inmutable.sql. Se puede volver a ejecutar sin problema.

begin;

create table if not exists public.intento_enlace (
  id         uuid primary key default gen_random_uuid(),
  ip_huella  varchar(64) not null,
  creado_en  timestamptz not null default now()
);
create index if not exists intento_enlace_ip_fecha on public.intento_enlace (ip_huella, creado_en);
create index if not exists intento_enlace_fecha on public.intento_enlace (creado_en);

alter table public.intento_enlace enable row level security;
-- Sin políticas a propósito. Y sin permisos para los usuarios.
revoke all on public.intento_enlace from anon, authenticated;

commit;

-- Comprobación (opcional, solo lectura): intentos fallidos de los últimos 15 minutos por conexión.
--   select ip_huella, count(*) from public.intento_enlace where creado_en > now() - interval '15 minutes' group by 1;
