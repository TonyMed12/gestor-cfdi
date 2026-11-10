-- Correcciones de la auditoría (H-01, H-02, H-04, H-05, H-08, H-10, H-18, H-23). Ejecutar después de 07.
-- Debe aplicarse junto con la versión de la app que lo usa: la app lee la vista resumen_cliente
-- y guarda las facturas con la clave de servicio.

begin;

-- H-01 y H-08 ---------------------------------------------------------------
-- Solo el servidor guarda facturas: procesarXml comprueba el permiso con la sesión del usuario
-- (al reservar el archivo) y escribe con la clave de servicio. Nadie las inserta desde el navegador.
revoke execute on function public.guardar_factura(uuid, jsonb, jsonb) from authenticated;
grant execute on function public.guardar_factura(uuid, jsonb, jsonb) to service_role;
drop policy "crear" on public.factura;
drop policy "crear" on public.concepto;
drop policy "crear" on public.impuesto;

-- Un archivo, una factura.
alter table public.factura add constraint factura_archivo_unico unique (archivo_id);

-- Igual que en 07, pero exige un XML reservado para lectura (estado 'leyendo').
create or replace function public.guardar_factura(p_archivo uuid, p_factura jsonb, p_conceptos jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_factura  uuid;
  v_concepto uuid;
  v_motivo   text := p_factura->>'motivo_exclusion';
  c jsonb;
  i jsonb;
begin
  perform 1 from public.archivo
  where id = p_archivo and tipo = 'xml' and estado = 'leyendo'
  for update;
  if not found then
    raise exception 'El archivo no existe o no está en lectura';
  end if;

  insert into public.factura (
    archivo_id, cliente_id, uuid_fiscal, tipo_comprobante, relacion,
    rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor,
    uso_cfdi, forma_pago, metodo_pago, subtotal, total, moneda,
    estado_revision, motivo_exclusion, emitido_en, timbrado_en)
  select a.id, a.cliente_id, p_factura->>'uuid_fiscal', p_factura->>'tipo_comprobante',
         (p_factura->>'relacion')::public.relacion_factura,
         p_factura->>'rfc_emisor', p_factura->>'nombre_emisor',
         p_factura->>'rfc_receptor', p_factura->>'nombre_receptor',
         p_factura->>'uso_cfdi', p_factura->>'forma_pago', p_factura->>'metodo_pago',
         (p_factura->>'subtotal')::numeric, (p_factura->>'total')::numeric, p_factura->>'moneda',
         case when v_motivo is null then 'por_revisar' else 'excluido' end::public.estado_revision,
         v_motivo,
         (p_factura->>'emitido_en')::timestamptz, (p_factura->>'timbrado_en')::timestamptz
  from public.archivo a
  where a.id = p_archivo
  returning id into v_factura;

  for c in select * from jsonb_array_elements(p_conceptos) loop
    insert into public.concepto (factura_id, clave_prod_serv, descripcion, cantidad, unidad, importe, objeto_impuesto)
    values (v_factura, c->>'clave_prod_serv', c->>'descripcion', (c->>'cantidad')::numeric,
            c->>'unidad', (c->>'importe')::numeric, c->>'objeto_impuesto')
    returning id into v_concepto;

    for i in select * from jsonb_array_elements(coalesce(c->'impuestos', '[]'::jsonb)) loop
      insert into public.impuesto (concepto_id, tipo, impuesto, tasa, importe)
      values (v_concepto, (i->>'tipo')::public.tipo_impuesto, i->>'impuesto',
              (i->>'tasa')::numeric, (i->>'importe')::numeric);
    end loop;
  end loop;

  update public.archivo
  set estado = case when v_motivo is null then 'por_revisar' else 'error' end::public.estado_archivo,
      motivo_error = v_motivo
  where id = p_archivo;

  return v_factura;
end $$;

-- create or replace conserva los permisos, pero se repiten para que quede explícito.
revoke execute on function public.guardar_factura(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_factura(uuid, jsonb, jsonb) to service_role;

-- H-04 ---------------------------------------------------------------------
-- Desde la sesión del usuario solo se cambian el estado y su motivo, y solo en estos pasos:
--   recibido -> leyendo (procesarXml reserva el archivo)
--   recibido -> error   (falló la subida)
--   leyendo  -> error   (el XML no se pudo leer)
-- La ruta, la huella y el cliente de un archivo registrado ya no se modifican (RF-06).
revoke update on public.archivo from authenticated;
grant update (estado, motivo_error) on public.archivo to authenticated;

create function public.archivo_transicion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (old.estado, new.estado) not in (
    ('recibido'::public.estado_archivo, 'leyendo'::public.estado_archivo),
    ('recibido'::public.estado_archivo, 'error'::public.estado_archivo),
    ('leyendo'::public.estado_archivo, 'error'::public.estado_archivo)
  ) then
    raise exception 'Cambio de estado no permitido: % a %', old.estado, new.estado;
  end if;
  return new;
end $$;

create trigger archivo_transicion before update on public.archivo
  for each row execute function public.archivo_transicion();

-- H-05 ---------------------------------------------------------------------
-- Un archivo con error no bloquea volver a subir el mismo contenido.
alter table public.archivo drop constraint archivo_cliente_id_huella_sha256_key;
create unique index archivo_huella_vigente on public.archivo (cliente_id, huella_sha256) where estado <> 'error';

-- H-10 ---------------------------------------------------------------------
-- Contadores por cliente. security_invoker: aplica la RLS de clientes y archivo de quien consulta.
create view public.resumen_cliente with (security_invoker = true) as
select c.id, c.razon_social, c.rfc,
       count(a.id) filter (where a.estado in ('recibido', 'leyendo')) as sin_leer,
       count(a.id) filter (where a.estado = 'por_revisar') as por_revisar,
       count(a.id) filter (where a.estado = 'error') as con_error
from public.clientes c
left join public.archivo a on a.cliente_id = c.id
group by c.id;

revoke all on public.resumen_cliente from anon;
grant select on public.resumen_cliente to authenticated;

-- H-23 ---------------------------------------------------------------------
-- Cada despacho conserva al menos un administrador activo.
create function public.proteger_ultimo_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.rol = 'administrador' and old.activo
     and (tg_op = 'DELETE' or new.rol <> 'administrador' or not new.activo or new.despacho_id <> old.despacho_id)
     and not exists (
       select 1 from public.usuario
       where despacho_id = old.despacho_id and rol = 'administrador' and activo and id <> old.id
     ) then
    raise exception 'El despacho debe conservar al menos un administrador activo';
  end if;
  return coalesce(new, old);
end $$;

create trigger proteger_ultimo_admin before update or delete on public.usuario
  for each row execute function public.proteger_ultimo_admin();

-- H-18 y H-02 --------------------------------------------------------------
alter function public.cliente_de_ruta(text) set search_path = '';

-- "not valid": se exigen a los datos nuevos sin fallar por filas antiguas.
-- Para revisarlas después: alter table ... validate constraint <nombre>;
alter table public.archivo
  add constraint archivo_huella_hex check (huella_sha256 ~ '^[0-9a-f]{64}$') not valid,
  add constraint archivo_ruta_del_cliente check (split_part(ruta_original, '/', 1) = cliente_id::text) not valid;
alter table public.clientes
  add constraint clientes_razon_social_no_vacia check (btrim(razon_social) <> '') not valid,
  add constraint clientes_rfc_formato check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$') not valid;
alter table public.factura
  add constraint factura_moneda_iso check (moneda ~ '^[A-Z]{3}$') not valid;

commit;
