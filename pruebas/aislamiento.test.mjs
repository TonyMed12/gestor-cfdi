// G1. Aislamiento entre despachos (RNF-08, S1-14): un usuario de un despacho no ve ni cambia datos de otro.
//
// Carga todos los scripts de supabase/ (01 a 22, sin el 99) en un Postgres en memoria (PGlite) con lo mínimo de
// Supabase (pruebas/aislamiento/supabase-simulado.sql). Crea dos despachos, A y B, con datos en cada tabla y un
// archivo en el almacenamiento, y entra como cada usuario de A (administrador, contador y auxiliar) y sin sesión
// para intentar leer, cambiar, borrar, crear y "mover" datos de B. Ninguno de esos accesos debe funcionar.
// Las acciones del servidor que usan la clave de servicio se revisan en docs/17-aislamiento-entre-despachos.md;
// la última prueba avisa si aparece un uso nuevo sin revisar.
//
// Requiere @electric-sql/pglite (dependencia de desarrollo). Si no está instalado, estas pruebas se omiten.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = process.env.RAIZ_PROYECTO ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const { PGlite } = await import("@electric-sql/pglite").catch(() => ({}));
const omitir = PGlite ? false : "falta instalar @electric-sql/pglite (npm ci)";

// Identificadores fijos para leer los resultados sin ambigüedad.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DESPACHOS = {
  A: { despacho: id(1), admin: id(11), contador: id(12), auxiliar: id(13), cliente: id(21), archivo: id(31), entrada: id(32), factura: id(41), concepto: id(51), impuesto: id(61), categoria: id(71), regla: id(81), sugerencia: id(91), rfc: "AAA010101AAA", clave: "01010101" },
  B: { despacho: id(2), admin: id(111), contador: id(112), auxiliar: id(113), cliente: id(121), archivo: id(131), entrada: id(132), factura: id(141), concepto: id(151), impuesto: id(161), categoria: id(171), regla: id(181), sugerencia: id(191), rfc: "BBB010101BBB", clave: "01010102" },
};
const B = DESPACHOS.B;

let db;

async function preparar() {
  db = new PGlite();
  await db.exec(readFileSync(join(RAIZ, "pruebas", "aislamiento", "supabase-simulado.sql"), "utf8"));
  const dir = join(RAIZ, "supabase");
  for (const f of readdirSync(dir).filter((f) => /^\d\d-.*\.sql$/.test(f) && !f.startsWith("99")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  await db.exec(`
    insert into public.cat_clave_prod_serv (clave, descripcion)
    values ('${DESPACHOS.A.clave}', 'Clave de prueba A'), ('${B.clave}', 'Clave de prueba B') on conflict do nothing;
  `);
  for (const [, d] of Object.entries(DESPACHOS)) {
    const ruta = `${d.cliente}/${d.archivo}/factura.xml`;
    const huella = (n) => n.replace(/-/g, "").padEnd(64, "0");
    // Las columnas "creado por" toman auth.uid() por omisión: los datos de cada despacho los crea su administrador.
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [d.admin]);
    await db.exec(`
      insert into public.despacho (id, nombre, rfc) values ('${d.despacho}', 'Despacho ${d.rfc}', '${d.rfc}');
      insert into auth.users (id, email) values
        ('${d.admin}', 'admin@${d.rfc}.mx'), ('${d.contador}', 'contador@${d.rfc}.mx'), ('${d.auxiliar}', 'auxiliar@${d.rfc}.mx');
      insert into public.usuario (id, despacho_id, nombre, correo, rol) values
        ('${d.admin}', '${d.despacho}', 'Admin', 'admin@${d.rfc}.mx', 'administrador'),
        ('${d.contador}', '${d.despacho}', 'Contador', 'contador@${d.rfc}.mx', 'contador'),
        ('${d.auxiliar}', '${d.despacho}', 'Auxiliar', 'auxiliar@${d.rfc}.mx', 'auxiliar');
      insert into public.clientes (id, despacho_id, razon_social, rfc, creado_por) values ('${d.cliente}', '${d.despacho}', 'Cliente ${d.rfc}', '${d.rfc}', '${d.admin}');
      insert into public.categoria (id, despacho_id, nombre) values ('${d.categoria}', '${d.despacho}', 'Categoría ${d.rfc}');
      insert into public.archivo (id, cliente_id, tipo, huella_sha256, ruta_original, estado)
        values ('${d.archivo}', '${d.cliente}', 'xml', '${huella(d.archivo)}', '${ruta}', 'por_revisar');
      insert into public.archivo (id, despacho_id, tipo, huella_sha256, ruta_original, estado, motivo_error, origen)
        values ('${d.entrada}', '${d.despacho}', 'xml', '${huella(d.entrada)}', 'entrada/${d.despacho}/${d.entrada}/x.xml', 'error', 'Sin cliente', 'entrada');
      insert into public.factura (id, archivo_id, cliente_id, uuid_fiscal, tipo_comprobante, relacion, rfc_emisor, rfc_receptor,
        uso_cfdi, subtotal, total, emitido_en, timbrado_en)
        values ('${d.factura}', '${d.archivo}', '${d.cliente}', '${d.factura}', 'I', 'recibida', 'XAXX010101000', '${d.rfc}',
        'G03', 100, 116, '2026-10-15T12:00:00Z', '2026-10-15T12:00:00Z');
      insert into public.concepto (id, factura_id, clave_prod_serv, descripcion, cantidad, importe, categoria_id)
        values ('${d.concepto}', '${d.factura}', '${d.clave}', 'Concepto', 1, 100, '${d.categoria}');
      insert into public.impuesto (id, concepto_id, tipo, impuesto, tasa, importe)
        values ('${d.impuesto}', '${d.concepto}', 'trasladado', 'IVA', 0.16, 16);
      insert into public.regla (id, cliente_id, condicion, categoria_id) values ('${d.regla}', '${d.cliente}', '{}', '${d.categoria}');
      insert into public.regla_emisor (despacho_id, rfc, categoria_id) values ('${d.despacho}', 'XAXX010101000', '${d.categoria}');
      insert into public.clave_categoria (despacho_id, clave, categoria_id) values ('${d.despacho}', '${d.clave}', '${d.categoria}');
      insert into public.sugerencia (id, factura_id, modelo, version_modelo, confianza, categoria_sugerida, explicacion)
        values ('${d.sugerencia}', '${d.factura}', 'm', '1', 90, 'Categoría', 'Porque sí');
      insert into public.bitacora (factura_id, usuario_id, accion, detalle) values ('${d.factura}', '${d.admin}', 'aprobo', '{}');
      insert into public.archivo_historial (archivo_id, estado) values ('${d.archivo}', 'por_revisar');
      insert into public.clasificacion_historial (concepto_id, categoria_anterior, categoria_nueva)
        values ('${d.concepto}', null, 'Categoría ${d.rfc}');
      insert into public.factura_relacion (factura_id, tipo_relacion, uuid_relacionado) values ('${d.factura}', '01', '${d.factura}');
      insert into public.enlace_acceso (cliente_id, token, vence_en) values ('${d.cliente}', '${d.cliente.replace(/-/g, "")}', now() + interval '1 day');
      insert into storage.objects (bucket_id, name) values ('facturas', '${ruta}'), ('facturas', 'entrada/${d.despacho}/${d.entrada}/x.xml');
    `);
  }
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
}

// Cada tabla o vista con datos de un despacho: cómo reconocer las filas de B y una columna para intentar cambiarla.
const TABLAS = {
  "public.despacho": { de_b: `id = '${B.despacho}'`, columna: "nombre" },
  "public.usuario": { de_b: `despacho_id = '${B.despacho}'`, columna: "nombre" },
  "public.clientes": { de_b: `despacho_id = '${B.despacho}'`, columna: "razon_social" },
  "public.archivo": { de_b: `cliente_id = '${B.cliente}' or despacho_id = '${B.despacho}'`, columna: "motivo_error" },
  "public.periodo": { de_b: `cliente_id = '${B.cliente}'`, columna: "mes_anio" },
  "public.factura": { de_b: `cliente_id = '${B.cliente}'`, columna: "uso_cfdi" },
  "public.concepto": { de_b: `factura_id = '${B.factura}'`, columna: "descripcion" },
  "public.impuesto": { de_b: `concepto_id = '${B.concepto}'`, columna: "importe" },
  "public.categoria": { de_b: `despacho_id = '${B.despacho}'`, columna: "nombre" },
  "public.regla": { de_b: `cliente_id = '${B.cliente}'`, columna: "condicion" },
  "public.regla_emisor": { de_b: `despacho_id = '${B.despacho}'`, columna: "rfc" },
  "public.clave_categoria": { de_b: `despacho_id = '${B.despacho}'`, columna: "categoria_id" },
  "public.sugerencia": { de_b: `factura_id = '${B.factura}'`, columna: "explicacion" },
  "public.bitacora": { de_b: `usuario_id in ('${B.admin}', '${B.contador}', '${B.auxiliar}') or factura_id = '${B.factura}'`, columna: "detalle" },
  "public.archivo_historial": { de_b: `archivo_id = '${B.archivo}'`, columna: "motivo" },
  "public.clasificacion_historial": { de_b: `concepto_id = '${B.concepto}'`, columna: "categoria_nueva" },
  "public.factura_relacion": { de_b: `factura_id = '${B.factura}'`, columna: "tipo_relacion" },
  "public.enlace_acceso": { de_b: `cliente_id = '${B.cliente}'`, columna: "token" },
  "public.resumen_cliente": { de_b: `id = '${B.cliente}'`, vista: true },
  "public.claves_en_uso": { de_b: `clave = '${B.clave}'`, vista: true },
  "storage.objects": { de_b: `name like '${B.cliente}/%' or name like 'entrada/${B.despacho}/%'`, columna: "name" },
};
// Catálogos del SAT: son públicos a propósito (iguales para todos los despachos).
const PUBLICAS = ["public.cat_clave_prod_serv", "public.cat_regimen_fiscal", "public.cat_uso_cfdi"];

// Ejecuta como un usuario de Supabase: rol de Postgres y usuario de la sesión (auth.uid()).
async function como(usuario, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ""]);
  await db.exec(`set role ${usuario ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

// Intenta una sentencia: devuelve las filas afectadas, o "error" si la base la rechazó.
async function intentar(sql) {
  try {
    const r = await db.query(sql);
    return r.affectedRows ?? r.rows.length;
  } catch {
    return "error";
  }
}

const filasDeB = async (tabla) => Number((await db.query(`select count(*)::int as n from ${tabla} where ${TABLAS[tabla].de_b}`)).rows[0].n);
const huella = async () => {
  const r = {};
  for (const t of Object.keys(TABLAS)) r[t] = JSON.stringify((await db.query(`select * from ${t} where ${TABLAS[t].de_b} order by 1`)).rows);
  return r;
};

const USUARIOS_A = [
  ["administrador de A", DESPACHOS.A.admin],
  ["contador de A", DESPACHOS.A.contador],
  ["auxiliar de A", DESPACHOS.A.auxiliar],
  ["sin sesión", null],
];

test("G1: los datos de prueba existen en los dos despachos (si no, las pruebas no probarían nada)", { skip: omitir }, async () => {
  await preparar();
  for (const t of Object.keys(TABLAS)) assert.ok((await filasDeB(t)) > 0, `${t} no tiene filas de B`);
  // Y el despacho A sí ve lo suyo: el aislamiento no es "nadie ve nada".
  const propias = await como(DESPACHOS.A.admin, async () => ({
    clientes: (await db.query("select count(*)::int n from public.clientes")).rows[0].n,
    facturas: (await db.query("select count(*)::int n from public.factura")).rows[0].n,
    archivos: (await db.query("select count(*)::int n from storage.objects")).rows[0].n,
  }));
  assert.deepEqual(propias, { clientes: 1, facturas: 1, archivos: 1 });
});

test("G1: todas las tablas de la base están en esta prueba o son catálogos públicos", { skip: omitir }, async () => {
  const r = await db.query(`
    select n.nspname || '.' || c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')`);
  const faltan = r.rows.map((x) => x.t).filter((t) => !TABLAS[t] && !PUBLICAS.includes(t));
  assert.deepEqual(faltan, [], "Tabla nueva sin prueba de aislamiento: agrégala a TABLAS");
  const sinRls = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(sinRls.rows, [], "Toda tabla de public debe tener RLS");
});

test("G1: nadie de A (ni sin sesión) ve filas de B en ninguna tabla ni archivo", { skip: omitir }, async () => {
  const vistas = [];
  for (const [nombre, usuario] of USUARIOS_A) {
    for (const t of Object.keys(TABLAS)) {
      const n = await como(usuario, () => intentar(`select 1 from ${t} where ${TABLAS[t].de_b}`));
      if (n !== 0 && n !== "error") vistas.push(`${nombre} ve ${n} fila(s) de B en ${t}`);
    }
  }
  assert.deepEqual(vistas, []);
});

test("G1: sin sesión no se ve nada de ningún despacho", { skip: omitir }, async () => {
  const vistas = [];
  for (const t of Object.keys(TABLAS)) {
    const n = await como(null, () => intentar(`select 1 from ${t}`));
    if (n !== 0 && n !== "error") vistas.push(`${t}: ${n}`);
  }
  assert.deepEqual(vistas, []);
});

test("G1: nadie de A cambia ni borra filas de B", { skip: omitir }, async () => {
  const antes = await huella();
  const logrados = [];
  for (const [nombre, usuario] of USUARIOS_A) {
    for (const [t, { de_b, columna, vista }] of Object.entries(TABLAS)) {
      if (vista) continue;
      const cambio = await como(usuario, () => intentar(`update ${t} set ${columna} = ${columna} where ${de_b}`));
      if (cambio !== 0 && cambio !== "error") logrados.push(`${nombre} cambió ${cambio} fila(s) de B en ${t}`);
      const borrado = await como(usuario, () => intentar(`delete from ${t} where ${de_b}`));
      if (borrado !== 0 && borrado !== "error") logrados.push(`${nombre} borró ${borrado} fila(s) de B en ${t}`);
    }
  }
  assert.deepEqual(logrados, []);
  assert.deepEqual(await huella(), antes, "Las filas de B cambiaron");
});

test("G1: nadie de A crea datos dentro de B ni que apunten a datos de B", { skip: omitir }, async () => {
  const intentos = {
    "cliente en B": `insert into public.clientes (despacho_id, razon_social, rfc) values ('${B.despacho}', 'X', 'XAXX010101000')`,
    "usuario en B": `insert into public.usuario (id, despacho_id, nombre, correo, rol) values ('${DESPACHOS.A.auxiliar}', '${B.despacho}', 'X', 'x@x.mx', 'administrador')`,
    "archivo de un cliente de B": `insert into public.archivo (cliente_id, tipo, huella_sha256, ruta_original) values ('${B.cliente}', 'xml', '${"a".repeat(64)}', '${B.cliente}/x/y.xml')`,
    "archivo en la entrada de B": `insert into public.archivo (despacho_id, tipo, huella_sha256, ruta_original, origen) values ('${B.despacho}', 'xml', '${"b".repeat(64)}', 'entrada/${B.despacho}/x/y.xml', 'entrada')`,
    "periodo de un cliente de B": `insert into public.periodo (cliente_id, mes_anio) values ('${B.cliente}', '2026-01')`,
    "factura de un cliente de B": `insert into public.factura (archivo_id, cliente_id, periodo_id, uuid_fiscal, tipo_comprobante, relacion, rfc_emisor, rfc_receptor, uso_cfdi, subtotal, total, emitido_en, timbrado_en) select '${B.archivo}', '${B.cliente}', id, 'X', 'I', 'recibida', 'X', 'X', 'G03', 1, 1, now(), now() from public.periodo limit 1`,
    "concepto en una factura de B": `insert into public.concepto (factura_id, clave_prod_serv, descripcion, cantidad, importe) values ('${B.factura}', '${B.clave}', 'X', 1, 1)`,
    "impuesto en un concepto de B": `insert into public.impuesto (concepto_id, tipo, impuesto, tasa, importe) values ('${B.concepto}', 'trasladado', 'IVA', 0.16, 1)`,
    "categoría de A para un cliente de B": `insert into public.categoria (despacho_id, cliente_id, nombre) values ('${DESPACHOS.A.despacho}', '${B.cliente}', 'X')`,
    "categoría en B": `insert into public.categoria (despacho_id, nombre) values ('${B.despacho}', 'X')`,
    "regla para un cliente de B": `insert into public.regla (cliente_id, condicion, categoria_id) values ('${B.cliente}', '{}', '${B.categoria}')`,
    "regla de emisor en B": `insert into public.regla_emisor (despacho_id, rfc, categoria_id) values ('${B.despacho}', 'XEXX010101000', '${B.categoria}')`,
    "regla de A con categoría de B": `insert into public.regla (cliente_id, condicion, categoria_id) values ('${DESPACHOS.A.cliente}', '{}', '${B.categoria}')`,
    "clave de A con categoría de B": `insert into public.clave_categoria (despacho_id, clave, categoria_id) values ('${DESPACHOS.A.despacho}', '${B.clave}', '${B.categoria}')`,
    "concepto de A con categoría de B": `insert into public.concepto (factura_id, clave_prod_serv, descripcion, cantidad, importe, categoria_id) values ('${DESPACHOS.A.factura}', '${DESPACHOS.A.clave}', 'X', 1, 1, '${B.categoria}')`,
    "regla de emisor de A con categoría de B": `insert into public.regla_emisor (despacho_id, rfc, categoria_id) values ('${DESPACHOS.A.despacho}', 'XEXX010101000', '${B.categoria}')`,
    "clave en B": `insert into public.clave_categoria (despacho_id, clave, categoria_id) values ('${B.despacho}', '${DESPACHOS.A.clave}', '${B.categoria}') on conflict do nothing`,
    "sugerencia en una factura de B": `insert into public.sugerencia (factura_id, modelo, version_modelo, confianza, categoria_sugerida, explicacion) values ('${B.factura}', 'm', '1', 1, 'X', 'X')`,
    "bitácora a nombre de alguien de B": `insert into public.bitacora (usuario_id, accion) values ('${B.admin}', 'aprobo')`,
    "bitácora sobre una factura de B": `insert into public.bitacora (factura_id, accion, detalle) values ('${B.factura}', 'aprobo', '{"motivo_periodo_cerrado": "Intento desde otro despacho"}')`,
    "historial de un archivo de B": `insert into public.archivo_historial (archivo_id, estado) values ('${B.archivo}', 'error')`,
    "historial de clasificación de B": `insert into public.clasificacion_historial (concepto_id, categoria_nueva) values ('${B.concepto}', 'X')`,
    "relación de una factura de B": `insert into public.factura_relacion (factura_id, tipo_relacion, uuid_relacionado) values ('${B.factura}', '04', 'X')`,
    "enlace de un cliente de B": `insert into public.enlace_acceso (cliente_id, token, vence_en) values ('${B.cliente}', 'x', now()) on conflict (cliente_id) do update set token = 'x'`,
    "archivo en la carpeta de un cliente de B": `insert into storage.objects (bucket_id, name) values ('facturas', '${B.cliente}/x/y.xml')`,
    "archivo en la entrada de B (almacenamiento)": `insert into storage.objects (bucket_id, name) values ('facturas', 'entrada/${B.despacho}/x/y.xml')`,
  };
  const antes = await huella();
  const logrados = [];
  for (const [nombre, usuario] of USUARIOS_A) {
    for (const [que, sql] of Object.entries(intentos)) {
      const n = await como(usuario, () => intentar(sql));
      if (n !== 0 && n !== "error") logrados.push(`${nombre}: ${que}`);
    }
  }
  assert.deepEqual(logrados, []);
  assert.deepEqual(await huella(), antes, "Aparecieron filas en B");
});

test("G1: nadie de A pasa sus propios datos a B", { skip: omitir }, async () => {
  const A = DESPACHOS.A;
  const intentos = {
    "su cliente a B": `update public.clientes set despacho_id = '${B.despacho}' where id = '${A.cliente}'`,
    "un usuario a B": `update public.usuario set despacho_id = '${B.despacho}' where id = '${A.auxiliar}'`,
    "su archivo a un cliente de B": `update public.archivo set cliente_id = '${B.cliente}' where id = '${A.archivo}'`,
    "su periodo a un cliente de B": `update public.periodo set cliente_id = '${B.cliente}' where cliente_id = '${A.cliente}'`,
    "su factura a un cliente de B": `update public.factura set cliente_id = '${B.cliente}' where id = '${A.factura}'`,
    "su concepto a una factura de B": `update public.concepto set factura_id = '${B.factura}' where id = '${A.concepto}'`,
    "su concepto a una categoría de B": `update public.concepto set categoria_id = '${B.categoria}' where id = '${A.concepto}'`,
    "su impuesto a un concepto de B": `update public.impuesto set concepto_id = '${B.concepto}' where id = '${A.impuesto}'`,
    "su categoría a un cliente de B": `update public.categoria set cliente_id = '${B.cliente}' where id = '${A.categoria}'`,
    "su categoría a B": `update public.categoria set despacho_id = '${B.despacho}' where id = '${A.categoria}'`,
    "su regla a un cliente de B": `update public.regla set cliente_id = '${B.cliente}' where id = '${A.regla}'`,
    "su regla de emisor a B": `update public.regla_emisor set despacho_id = '${B.despacho}' where despacho_id = '${A.despacho}'`,
    "su clave a B": `update public.clave_categoria set despacho_id = '${B.despacho}' where despacho_id = '${A.despacho}'`,
    "su regla a una categoría de B": `update public.regla set categoria_id = '${B.categoria}' where id = '${A.regla}'`,
    "su regla de emisor a una categoría de B": `update public.regla_emisor set categoria_id = '${B.categoria}' where despacho_id = '${A.despacho}'`,
    "su clave a una categoría de B": `update public.clave_categoria set categoria_id = '${B.categoria}' where despacho_id = '${A.despacho}'`,
    "su sugerencia a una factura de B": `update public.sugerencia set factura_id = '${B.factura}' where id = '${A.sugerencia}'`,
    "su archivo a la carpeta de B (almacenamiento)": `update storage.objects set name = '${B.cliente}/x/y.xml' where name like '${A.cliente}/%'`,
  };
  const logrados = [];
  for (const [nombre, usuario] of USUARIOS_A) {
    for (const [que, sql] of Object.entries(intentos)) {
      const n = await como(usuario, () => intentar(sql));
      if (n !== 0 && n !== "error") logrados.push(`${nombre}: ${que}`);
    }
  }
  assert.deepEqual(logrados, []);
  // B sigue con exactamente sus propias filas.
  const clientesDeB = (await db.query(`select count(*)::int n from public.clientes where despacho_id = '${B.despacho}'`)).rows[0].n;
  assert.equal(clientesDeB, 1);
});

test("G1: dentro de su propio despacho, A sigue trabajando normal (las reglas no bloquean de más)", { skip: omitir }, async () => {
  const A = DESPACHOS.A;
  const permitidos = {
    "categoría nueva": [A.contador, `insert into public.categoria (despacho_id, nombre) values ('${A.despacho}', 'Nueva de A')`],
    "categoría de un cliente propio": [A.contador, `update public.categoria set cliente_id = '${A.cliente}' where id = '${A.categoria}'`],
    "concepto con categoría propia": [A.contador, `update public.concepto set categoria_id = '${A.categoria}' where id = '${A.concepto}'`],
    "concepto sin categoría": [A.admin, `update public.concepto set categoria_id = null where id = '${A.concepto}'`],
    "regla con categoría propia": [A.contador, `insert into public.regla (cliente_id, condicion, categoria_id) values ('${A.cliente}', '{"x": 1}', '${A.categoria}')`],
    "bitácora sobre su factura": [A.auxiliar, `insert into public.bitacora (factura_id, usuario_id, accion) values ('${A.factura}', '${A.auxiliar}', 'subio')`],
    "bitácora sin factura": [A.auxiliar, `insert into public.bitacora (usuario_id, accion) values ('${A.auxiliar}', 'subio')`],
    "editar su cliente": [A.contador, `update public.clientes set razon_social = 'Cliente A editado' where id = '${A.cliente}'`],
  };
  const fallaron = [];
  for (const [que, [usuario, sql]] of Object.entries(permitidos)) {
    const n = await como(usuario, () => intentar(sql));
    if (n === "error" || n === 0) fallaron.push(`${que}: ${n}`);
  }
  assert.deepEqual(fallaron, []);
});

test("G1: las funciones que un usuario puede llamar no revelan datos de B", { skip: omitir }, async () => {
  // Funciones de public que se ejecutan con permisos del dueño y que un usuario puede llamar por la API.
  const r = await db.query(`
    select p.proname from pg_proc p join pg_type t on t.oid = p.prorettype
    where p.pronamespace = 'public'::regnamespace and p.prosecdef and t.typname <> 'trigger'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
    order by 1`);
  // Revisadas: solo responden sobre el usuario en sesión. Una función nueva aquí debe revisarse y agregarse.
  const revisadas = ["cliente_es_mio", "concepto_es_mio", "es_admin", "es_decisor", "es_personal", "factura_es_mia", "mi_despacho", "mi_rol"];
  assert.deepEqual(r.rows.map((x) => x.proname), revisadas, "Función con permisos del dueño sin revisar");
  const respuestas = await como(DESPACHOS.A.admin, async () => (await db.query(`select
    public.cliente_es_mio('${B.cliente}') c, public.factura_es_mia('${B.factura}') f, public.concepto_es_mio('${B.concepto}') k,
    public.mi_despacho() = '${DESPACHOS.A.despacho}' d`)).rows[0]);
  assert.deepEqual(respuestas, { c: false, f: false, k: false, d: true });
});

test("G1: cada uso de la clave de servicio (que salta RLS) está revisado en docs/17", () => {
  // La clave de servicio salta RLS: cada uso debe comprobar antes, con la sesión del usuario, que el dato es suyo.
  // Si cambia este conteo, revisa el uso nuevo y actualiza docs/17-aislamiento-entre-despachos.md y esta lista.
  const revisados = {
    "src/app/clientes/[clienteId]/acciones.ts": 12,
    "src/app/enviar/[token]/acciones.ts": 1,
    "src/app/enviar/[token]/page.tsx": 1,
    "src/app/revision/[facturaId]/acciones.ts": 2,
    "src/app/usuarios/acciones.ts": 2,
    "src/lib/datos.ts": 1,
    "src/lib/enlace.ts": 1,
  };
  const usos = {};
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(ts|tsx)$/.test(nombre) && !ruta.endsWith("supabase-admin.ts")) {
        const n = (readFileSync(ruta, "utf8").match(/supabaseAdmin\(\)/g) ?? []).length;
        if (n > 0) usos[relative(RAIZ, ruta).replace(/\\/g, "/")] = n;
      }
    }
  };
  recorrer(join(RAIZ, "src"));
  assert.deepEqual(usos, revisados);
});
