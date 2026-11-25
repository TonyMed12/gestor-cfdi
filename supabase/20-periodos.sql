-- Periodos mensuales por cliente (C1, S3-09, RF-39): cada factura pertenece al periodo del mes de su fecha de emisión.
-- La tabla periodo ya existe desde 02-esquema.sql, con unique (cliente_id, mes_anio): no hay dos periodos del mismo mes.
-- Este script crea el periodo cuando hace falta, lo asigna a cada factura al guardarla y llena las facturas que ya existen.
-- Ejecutar después de 19-sincronizar-estados.sql. Se puede volver a ejecutar sin problema.

begin;

-- 1) Mes del periodo (AAAA-MM) de una fecha de emisión.
-- La app guarda la fecha del CFDI como hora del centro de México con desfase fijo de -06:00 (cfdi.ts y pdf.ts),
-- así que el mes se calcula con ese mismo desfase, no en UTC: una factura del 31 de enero a las 20:00
-- se guarda como 1 de febrero 02:00 UTC y debe quedar en enero.
create or replace function public.mes_de_periodo(p_fecha timestamptz) returns varchar(7)
language sql immutable set search_path = '' as $$
  select to_char(p_fecha at time zone interval '-06:00', 'YYYY-MM')
$$;

-- 2) Periodo del cliente para una fecha. Si aún no existe, lo crea abierto.
-- on conflict usa unique (cliente_id, mes_anio): dos facturas del mismo mes al mismo tiempo no duplican el periodo.
create or replace function public.periodo_de_factura(p_cliente uuid, p_fecha timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_mes varchar(7) := public.mes_de_periodo(p_fecha);
  v_id  uuid;
begin
  insert into public.periodo (cliente_id, mes_anio) values (p_cliente, v_mes)
  on conflict (cliente_id, mes_anio) do nothing;
  select id into v_id from public.periodo where cliente_id = p_cliente and mes_anio = v_mes;
  return v_id;
end $$;

-- Solo la usan el trigger y este script: ningún usuario de la app la llama directo.
revoke execute on function public.periodo_de_factura(uuid, timestamptz) from public, anon, authenticated;

-- 3) Al guardar una factura, o si cambia su fecha, su cliente o su periodo, el periodo se recalcula.
-- Así nadie puede dejar una factura en un periodo que no corresponde a su fecha (RF-39).
-- Un periodo cerrado también recibe sus facturas; bloquear cambios en periodos cerrados es la tarea D4.
create or replace function public.asignar_periodo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.periodo_id := public.periodo_de_factura(new.cliente_id, new.emitido_en);
  return new;
end $$;

revoke execute on function public.asignar_periodo() from public, anon, authenticated;

drop trigger if exists factura_asignar_periodo on public.factura;
create trigger factura_asignar_periodo
  before insert or update of emitido_en, cliente_id, periodo_id on public.factura
  for each row execute function public.asignar_periodo();

-- 4) Facturas que ya existen: el trigger les asigna su periodo.
update public.factura
set periodo_id = public.periodo_de_factura(cliente_id, emitido_en)
where periodo_id is distinct from public.periodo_de_factura(cliente_id, emitido_en);

-- 5) Desde ahora toda factura tiene periodo.
alter table public.factura alter column periodo_id set not null;

create index if not exists factura_periodo_idx on public.factura (periodo_id);

commit;

-- Comprobación (opcional, solo lectura). Las tres deben devolver cero filas o cero:
--
-- Facturas sin periodo:
--   select count(*) from public.factura where periodo_id is null;
--
-- Facturas en un periodo que no es el de su fecha o de otro cliente:
--   select f.id, f.emitido_en, p.mes_anio from public.factura f join public.periodo p on p.id = f.periodo_id
--   where p.cliente_id <> f.cliente_id or p.mes_anio <> public.mes_de_periodo(f.emitido_en);
--
-- Periodos duplicados por mes:
--   select cliente_id, mes_anio, count(*) from public.periodo group by 1, 2 having count(*) > 1;
--
-- Periodos con su número de facturas:
--   select c.razon_social, p.mes_anio, p.estado, count(f.id) as facturas
--   from public.periodo p join public.clientes c on c.id = p.cliente_id
--   left join public.factura f on f.periodo_id = p.id
--   group by 1, 2, 3 order by 1, 2;
