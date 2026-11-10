-- Lectura de XML (S2-01 a S2-05). Ejecutar después de 06.
-- Agrega columnas y una función que guarda una factura con sus conceptos e impuestos en una sola operación.

begin;

alter table public.archivo add column motivo_error text;

-- Hasta que se consulte al SAT, el estado y la fecha de consulta quedan vacíos.
alter table public.factura
  alter column estado_sat drop not null,
  alter column fecha_consulta_sat drop not null,
  add column nombre_emisor text,
  add column nombre_receptor text;

-- Corre con los permisos de quien la llama (RLS aplica). Si algo falla, no se guarda nada.
create function public.guardar_factura(p_archivo uuid, p_factura jsonb, p_conceptos jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_factura  uuid;
  v_concepto uuid;
  v_motivo   text := p_factura->>'motivo_exclusion';
  c jsonb;
  i jsonb;
begin
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

  if v_factura is null then
    raise exception 'El archivo no existe o no tienes permiso para procesarlo';
  end if;

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

  -- Una factura excluida queda con error y su motivo; las demás pasan a revisión.
  update public.archivo
  set estado = case when v_motivo is null then 'por_revisar' else 'error' end::public.estado_archivo,
      motivo_error = v_motivo
  where id = p_archivo;

  return v_factura;
end $$;

revoke execute on function public.guardar_factura(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_factura(uuid, jsonb, jsonb) to authenticated;

commit;
