-- Cierre de periodo (D4, RF-43, RN-07): al cerrar, el periodo deja de cambiar. Un cambio posterior solo se permite
-- si antes quedó en la bitácora con su motivo.
--
-- Qué hace:
-- 1) Cerrar: el periodo pasa a "cerrado" con la fecha y quién lo cerró. No se puede cerrar si tiene facturas por
--    revisar o por confirmar (el resumen estaría incompleto). Un periodo cerrado no se reabre.
-- 2) En un periodo cerrado, sin un motivo reciente en la bitácora para esa factura, no se puede:
--    - aprobar, rechazar o excluir una factura, ni regresarla a revisión;
--    - cambiar una factura aprobada: deducibilidad, estado ante el SAT, motivo, importes, fecha o cliente;
--    - mover una factura aprobada o excluida a otro periodo (o meterla a uno cerrado);
--    - cambiar la categoría o el importe de un concepto de una factura aprobada;
--    - borrar una factura aprobada.
--    Lo que no toca el resumen sigue igual: llegan facturas nuevas (como pendientes), las pendientes se pueden
--    revisar y sus categorías sugeridas cambian con las claves (A3).
-- 3) El motivo: una fila de la bitácora de esa factura, de los últimos 10 minutos, con detalle.motivo_periodo_cerrado
--    (mínimo 5 caracteres) y escrita por la misma persona. La aplicación la escribe antes de hacer el cambio
--    (src/app/revision/[facturaId]/acciones.ts).
--
-- Ejecutar después de 21-deducible-por-factura.sql. Se puede volver a ejecutar sin problema.
-- Errores que devuelve (la aplicación los traduce):
--   PC001 cambio en periodo cerrado sin motivo · PC002 cerrar con facturas pendientes · PC003 reabrir o editar un periodo cerrado

begin;

-- 1) ¿Hay un motivo reciente en la bitácora para cambiar esta factura de un periodo cerrado?
create or replace function public.hay_motivo_periodo_cerrado(p_factura uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bitacora b
    where b.factura_id = p_factura
      and length(trim(coalesce(b.detalle ->> 'motivo_periodo_cerrado', ''))) >= 5
      and b.ocurrido_en > now() - interval '10 minutes'
      -- Con la sesión del usuario, el motivo debe ser suyo. La clave de servicio (sin sesión) solo la usa el servidor.
      and (auth.uid() is null or b.usuario_id = auth.uid())
  )
$$;
revoke execute on function public.hay_motivo_periodo_cerrado(uuid) from public, anon, authenticated;

create or replace function public.periodo_esta_cerrado(p_periodo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select estado = 'cerrado' from public.periodo where id = p_periodo), false)
$$;
revoke execute on function public.periodo_esta_cerrado(uuid) from public, anon, authenticated;

-- 2) Facturas.
create or replace function public.proteger_factura_periodo_cerrado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_factura uuid := coalesce(new.id, old.id);
  v_decidida_antes boolean := tg_op <> 'INSERT' and old.estado_revision in ('clasificado', 'excluido');
  v_protegido boolean := false;
begin
  if tg_op = 'INSERT' then
    return new; -- las facturas nuevas sí llegan a un periodo cerrado, como pendientes
  end if;

  if tg_op = 'DELETE' then
    v_protegido := old.estado_revision = 'clasificado' and public.periodo_esta_cerrado(old.periodo_id);
  else
    -- periodo_id ya viene recalculado por factura_asignar_periodo (20-periodos.sql), que corre antes por nombre.
    if public.periodo_esta_cerrado(old.periodo_id) or public.periodo_esta_cerrado(new.periodo_id) then
      v_protegido :=
        -- aprobar, rechazar, excluir o regresar a revisión
        (new.estado_revision is distinct from old.estado_revision
          and (v_decidida_antes or new.estado_revision in ('clasificado', 'excluido')))
        -- mover de periodo una factura ya decidida
        or (v_decidida_antes and new.periodo_id is distinct from old.periodo_id)
        -- cambiar una factura aprobada en lo que cuenta para el resumen
        or (old.estado_revision = 'clasificado' and (
              new.deducible is distinct from old.deducible
           or new.estado_sat is distinct from old.estado_sat
           or new.motivo_exclusion is distinct from old.motivo_exclusion
           or new.total is distinct from old.total
           or new.moneda is distinct from old.moneda
           or new.tipo_comprobante is distinct from old.tipo_comprobante
           or new.relacion is distinct from old.relacion
           or new.cliente_id is distinct from old.cliente_id
           or new.emitido_en is distinct from old.emitido_en));
    end if;
  end if;

  if v_protegido and not public.hay_motivo_periodo_cerrado(v_factura) then
    raise exception 'La factura es de un periodo cerrado: el cambio necesita un motivo en la bitácora.'
      using errcode = 'PC001';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.proteger_factura_periodo_cerrado() from public, anon, authenticated;

drop trigger if exists factura_proteger_periodo_cerrado on public.factura;
create trigger factura_proteger_periodo_cerrado
  before update or delete on public.factura
  for each row execute function public.proteger_factura_periodo_cerrado();

-- 3) Conceptos de facturas aprobadas en periodos cerrados: su categoría e importe ya están en el resumen.
--    Las facturas por revisar o excluidas no cuentan en el resumen: sus categorías siguen cambiando con las claves (A3).
create or replace function public.proteger_concepto_periodo_cerrado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_factura uuid := coalesce(new.factura_id, old.factura_id);
begin
  if tg_op = 'UPDATE'
     and new.categoria_id is not distinct from old.categoria_id
     and new.importe is not distinct from old.importe
     and new.factura_id is not distinct from old.factura_id then
    return new;
  end if;
  if exists (
    select 1 from public.factura f
    where f.id = v_factura and f.estado_revision = 'clasificado' and public.periodo_esta_cerrado(f.periodo_id)
  ) and not public.hay_motivo_periodo_cerrado(v_factura) then
    raise exception 'La factura es de un periodo cerrado: el cambio necesita un motivo en la bitácora.'
      using errcode = 'PC001';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.proteger_concepto_periodo_cerrado() from public, anon, authenticated;

drop trigger if exists concepto_proteger_periodo_cerrado on public.concepto;
create trigger concepto_proteger_periodo_cerrado
  before update of categoria_id, importe, factura_id or delete on public.concepto
  for each row execute function public.proteger_concepto_periodo_cerrado();

-- 4) Periodos: cerrar sin pendientes, con fecha y quién; un periodo cerrado no se reabre ni se edita.
create or replace function public.cerrar_periodo_reglas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pendientes integer;
begin
  if old.estado = 'cerrado' then
    if new.estado <> 'cerrado' then
      raise exception 'Un periodo cerrado no se puede reabrir.' using errcode = 'PC003';
    end if;
    if new.cliente_id is distinct from old.cliente_id or new.mes_anio is distinct from old.mes_anio
       or new.cerrado_en is distinct from old.cerrado_en or new.cerrado_por is distinct from old.cerrado_por then
      raise exception 'Un periodo cerrado no se puede editar.' using errcode = 'PC003';
    end if;
    return new;
  end if;

  if new.estado = 'cerrado' then
    select count(*) into v_pendientes from public.factura
    where periodo_id = new.id and estado_revision in ('por_revisar', 'por_confirmar');
    if v_pendientes > 0 then
      raise exception 'El periodo tiene % factura(s) por revisar: apruébalas o recházalas antes de cerrar.', v_pendientes
        using errcode = 'PC002';
    end if;
    new.cerrado_en := now();
    new.cerrado_por := coalesce(auth.uid(), new.cerrado_por);
  end if;
  return new;
end $$;
revoke execute on function public.cerrar_periodo_reglas() from public, anon, authenticated;

drop trigger if exists periodo_cerrar_reglas on public.periodo;
create trigger periodo_cerrar_reglas
  before update on public.periodo
  for each row execute function public.cerrar_periodo_reglas();

-- Un periodo cerrado no se borra.
create or replace function public.no_borrar_periodo_cerrado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'cerrado' then
    raise exception 'Un periodo cerrado no se puede borrar.' using errcode = 'PC003';
  end if;
  return old;
end $$;
revoke execute on function public.no_borrar_periodo_cerrado() from public, anon, authenticated;

drop trigger if exists periodo_no_borrar_cerrado on public.periodo;
create trigger periodo_no_borrar_cerrado
  before delete on public.periodo
  for each row execute function public.no_borrar_periodo_cerrado();

commit;

-- Comprobación (opcional, solo lectura):
-- Periodos cerrados, cuándo y quién:
--   select p.mes_anio, c.razon_social, p.cerrado_en, u.nombre
--   from public.periodo p join public.clientes c on c.id = p.cliente_id left join public.usuario u on u.id = p.cerrado_por
--   where p.estado = 'cerrado';
-- Cambios en periodos cerrados con su motivo:
--   select ocurrido_en, accion, detalle ->> 'motivo_periodo_cerrado' as motivo, factura_id
--   from public.bitacora where detalle ? 'motivo_periodo_cerrado' order by ocurrido_en desc;
