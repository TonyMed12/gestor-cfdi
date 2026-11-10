-- Catálogos del SAT como datos, para actualizarlos sin cambiar código (RNF-23). Ejecutar después de 05.
-- Uso de CFDI y régimen fiscal vienen cargados; contrastarlos con el catálogo oficial vigente.
-- La clave de producto o servicio (cat_clave_prod_serv) es muy grande: se importa desde el
-- catálogo oficial con Table Editor > Insert > Import data from CSV (no pasa por RLS).

begin;

create table public.cat_uso_cfdi (
  clave        varchar(4) primary key,
  descripcion  text not null
);

create table public.cat_regimen_fiscal (
  clave        varchar(3) primary key,
  descripcion  text not null
);

create table public.cat_clave_prod_serv (
  clave        varchar(8) primary key,
  descripcion  text not null
);

do $$
declare
  t text;
begin
  foreach t in array array['cat_uso_cfdi', 'cat_regimen_fiscal', 'cat_clave_prod_serv']
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Solo lectura desde la app: los catálogos son datos compartidos y se cargan con permisos de propietario.
    execute format('create policy "ver" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

insert into public.cat_uso_cfdi (clave, descripcion) values
  ('G01', 'Adquisición de mercancías'),
  ('G02', 'Devoluciones, descuentos o bonificaciones'),
  ('G03', 'Gastos en general'),
  ('I01', 'Construcciones'),
  ('I02', 'Mobiliario y equipo de oficina por inversiones'),
  ('I03', 'Equipo de transporte'),
  ('I04', 'Equipo de cómputo y accesorios'),
  ('I05', 'Dados, troqueles, moldes, matrices y herramental'),
  ('I06', 'Comunicaciones telefónicas'),
  ('I07', 'Comunicaciones satelitales'),
  ('I08', 'Otra maquinaria y equipo'),
  ('D01', 'Honorarios médicos, dentales y gastos hospitalarios'),
  ('D02', 'Gastos médicos por incapacidad o discapacidad'),
  ('D03', 'Gastos funerales'),
  ('D04', 'Donativos'),
  ('D05', 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)'),
  ('D06', 'Aportaciones voluntarias al SAR'),
  ('D07', 'Primas por seguros de gastos médicos'),
  ('D08', 'Gastos de transportación escolar obligatoria'),
  ('D09', 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones'),
  ('D10', 'Pagos por servicios educativos (colegiaturas)'),
  ('S01', 'Sin efectos fiscales'),
  ('CP01', 'Pagos'),
  ('CN01', 'Nómina');

insert into public.cat_regimen_fiscal (clave, descripcion) values
  ('601', 'General de Ley Personas Morales'),
  ('603', 'Personas Morales con Fines no Lucrativos'),
  ('605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios'),
  ('606', 'Arrendamiento'),
  ('607', 'Régimen de Enajenación o Adquisición de Bienes'),
  ('608', 'Demás ingresos'),
  ('610', 'Residentes en el Extranjero sin Establecimiento Permanente en México'),
  ('611', 'Ingresos por Dividendos (socios y accionistas)'),
  ('612', 'Personas Físicas con Actividades Empresariales y Profesionales'),
  ('614', 'Ingresos por intereses'),
  ('615', 'Régimen de los ingresos por obtención de premios'),
  ('616', 'Sin obligaciones fiscales'),
  ('620', 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos'),
  ('621', 'Incorporación Fiscal'),
  ('622', 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras'),
  ('623', 'Opcional para Grupos de Sociedades'),
  ('624', 'Coordinados'),
  ('625', 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas'),
  ('626', 'Régimen Simplificado de Confianza'),
  ('628', 'Hidrocarburos'),
  ('629', 'De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales'),
  ('630', 'Enajenación de acciones en bolsa de valores');

commit;
