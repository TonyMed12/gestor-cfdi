-- Los clientes pasan de pertenecer a un usuario a pertenecer a un despacho.
-- Ejecutar después de 02-esquema.sql y de haber creado el despacho y el usuario administrador.

begin;

-- 1) Los clientes existentes quedan en el despacho de quien los creó.
update public.clientes c
set despacho_id = u.despacho_id
from public.usuario u
where u.id = c.user_id and c.despacho_id is null;

-- 2) Si algún cliente sigue sin despacho, se detiene todo antes de cambiar nada más.
do $$
begin
  if exists (select 1 from public.clientes where despacho_id is null) then
    raise exception 'Hay clientes cuyo creador no tiene usuario en un despacho. Crea ese usuario o bórralos y vuelve a ejecutar.';
  end if;
end $$;

-- 3) Desde ahora el despacho es obligatorio y se asigna solo al crear un cliente.
alter table public.clientes
  alter column despacho_id set not null,
  alter column despacho_id set default public.mi_despacho();

-- 4) user_id conserva quién lo creó, pero ya no controla el acceso.
alter table public.clientes rename column user_id to creado_por;
alter table public.clientes drop constraint clientes_user_id_rfc_key;
-- clientes_despacho_rfc_idx (script 02) ya impide repetir el RFC dentro del despacho.

-- 5) Seguridad por despacho en lugar de por usuario.
drop policy "ver mis clientes" on public.clientes;
drop policy "crear mis clientes" on public.clientes;
drop policy "editar mis clientes" on public.clientes;
drop policy "borrar mis clientes" on public.clientes;

create policy "mi despacho" on public.clientes
  for all to authenticated
  using (despacho_id = public.mi_despacho())
  with check (despacho_id = public.mi_despacho());

commit;
