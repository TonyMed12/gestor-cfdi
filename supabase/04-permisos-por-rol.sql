-- Permisos por rol dentro del despacho (RF-46, RN-05). Ejecutar después de 03.
--
--                          administrador  contador  auxiliar
-- ver                           si           si        si
-- crear clientes y periodos     si           si        no
-- subir archivos y capturar     si           si        si
-- editar facturas y decidir     si           si        no   (el auxiliar solo captura y lee)
-- borrar                        si           no        no
-- El rol cliente no ve nada hasta que se defina su acceso (tarea S4-06).

begin;

create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.mi_rol() = 'administrador', false)
$$;

create function public.es_decisor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.mi_rol() in ('administrador', 'contador'), false)
$$;

create function public.es_personal() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.mi_rol() in ('administrador', 'contador', 'auxiliar'), false)
$$;

revoke execute on function public.es_admin(), public.es_decisor(), public.es_personal() from public, anon;
grant execute on function public.es_admin(), public.es_decisor(), public.es_personal() to authenticated;

-- Reemplaza la política única "mi despacho" por una política por operación.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('clientes',   'despacho_id = public.mi_despacho()',          'es_decisor',  'es_decisor',  'es_admin'),
      ('archivo',    'public.cliente_es_mio(cliente_id)',           'es_personal', 'es_personal', 'es_admin'),
      ('periodo',    'public.cliente_es_mio(cliente_id)',           'es_decisor',  'es_decisor',  'es_admin'),
      ('factura',    'public.cliente_es_mio(cliente_id)',           'es_personal', 'es_decisor',  'es_admin'),
      ('regla',      'public.cliente_es_mio(cliente_id)',           'es_decisor',  'es_decisor',  'es_decisor'),
      ('categoria',  'despacho_id = public.mi_despacho()',          'es_decisor',  'es_decisor',  'es_decisor'),
      ('concepto',   'public.factura_es_mia(factura_id)',           'es_personal', 'es_decisor',  'es_admin'),
      ('impuesto',   'public.concepto_es_mio(concepto_id)',         'es_personal', 'es_decisor',  'es_admin'),
      ('sugerencia', 'public.factura_es_mia(factura_id)',           'es_personal', 'es_decisor',  'es_admin')
    ) as v(tabla, ambito, quien_crea, quien_edita, quien_borra)
  loop
    execute format('drop policy "mi despacho" on public.%I', t.tabla);
    execute format('create policy "ver" on public.%I for select to authenticated using ((%s) and public.es_personal())',
                   t.tabla, t.ambito);
    execute format('create policy "crear" on public.%I for insert to authenticated with check (%s and public.%I())',
                   t.tabla, t.ambito, t.quien_crea);
    execute format('create policy "editar" on public.%I for update to authenticated using (%s and public.%I()) with check (%s)',
                   t.tabla, t.ambito, t.quien_edita, t.ambito);
    execute format('create policy "borrar" on public.%I for delete to authenticated using (%s and public.%I())',
                   t.tabla, t.ambito, t.quien_borra);
  end loop;
end $$;

commit;
