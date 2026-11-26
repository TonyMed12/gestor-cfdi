// G5. Nadie puede modificar ni borrar la bitácora (RNF-22, S1-05): ni los usuarios ni el servidor.
// Carga los scripts de supabase/ en un Postgres en memoria (PGlite), como la prueba de G1, y lo intenta con cada rol de
// la aplicación (administrador, contador, auxiliar), sin sesión y con la clave de servicio.
// Requiere @electric-sql/pglite (dependencia de desarrollo). Si no está instalado, estas pruebas se omiten.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const { PGlite } = await import("@electric-sql/pglite").catch(() => ({}));
const omitir = PGlite ? false : "falta instalar @electric-sql/pglite (npm ci)";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const D = { despacho: id(1), admin: id(11), contador: id(12), auxiliar: id(13), cliente: id(21), archivo: id(31), factura: id(41) };
const ROLES = [
  ["administrador", D.admin, "authenticated"],
  ["contador", D.contador, "authenticated"],
  ["auxiliar", D.auxiliar, "authenticated"],
  ["sin sesión", null, "anon"],
  ["clave de servicio", null, "service_role"],
];

let db;

async function preparar() {
  db = new PGlite();
  await db.exec(readFileSync(join(RAIZ, "pruebas", "aislamiento", "supabase-simulado.sql"), "utf8"));
  const dir = join(RAIZ, "supabase");
  for (const f of readdirSync(dir).filter((f) => /^\d\d-.*\.sql$/.test(f) && !f.startsWith("99")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [D.admin]);
  await db.exec(`
    insert into public.despacho (id, nombre, rfc) values ('${D.despacho}', 'Despacho', 'AAA010101AAA');
    insert into auth.users (id) values ('${D.admin}'), ('${D.contador}'), ('${D.auxiliar}');
    insert into public.usuario (id, despacho_id, nombre, correo, rol) values
      ('${D.admin}', '${D.despacho}', 'Admin', 'a@x.mx', 'administrador'),
      ('${D.contador}', '${D.despacho}', 'Contador', 'c@x.mx', 'contador'),
      ('${D.auxiliar}', '${D.despacho}', 'Auxiliar', 'x@x.mx', 'auxiliar');
    insert into public.clientes (id, despacho_id, razon_social, rfc) values ('${D.cliente}', '${D.despacho}', 'Cliente', 'AAA010101AAA');
    insert into public.archivo (id, cliente_id, tipo, huella_sha256, ruta_original, estado)
      values ('${D.archivo}', '${D.cliente}', 'xml', '${"a".repeat(64)}', '${D.cliente}/${D.archivo}/f.xml', 'por_revisar');
    insert into public.factura (id, archivo_id, cliente_id, uuid_fiscal, tipo_comprobante, relacion, rfc_emisor, rfc_receptor,
      uso_cfdi, subtotal, total, emitido_en, timbrado_en)
      values ('${D.factura}', '${D.archivo}', '${D.cliente}', 'X', 'I', 'recibida', 'XAXX010101000', 'AAA010101AAA', 'G03', 100, 116, now(), now());
  `);
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  // Registros escritos por la aplicación, cada uno con la sesión de su usuario.
  for (const [, usuario] of ROLES.slice(0, 3)) {
    await como(usuario, "authenticated", () =>
      db.exec(`insert into public.bitacora (factura_id, accion, detalle) values ('${D.factura}', 'aprobo', '{"conceptos_corregidos": 0}')`));
  }
}

async function como(usuario, rol, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ""]);
  await db.exec(`set role ${rol}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function intentar(sql) {
  try {
    const r = await db.query(sql);
    // Un SELECT reporta affectedRows = 0 aunque traiga filas: se cuentan sus filas. UPDATE/DELETE/INSERT: affectedRows.
    return r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0);
  } catch (e) {
    return `error ${e.code ?? ""}`.trim();
  }
}

const foto = async () => JSON.stringify((await db.query("select * from public.bitacora order by id")).rows);

test("G5: hay registros de la bitácora para intentar cambiarlos", { skip: omitir }, async () => {
  await preparar();
  assert.equal((await db.query("select count(*)::int n from public.bitacora")).rows[0].n, 3);
});

test("G5: ningún rol de la aplicación, ni la clave de servicio, modifica ni borra la bitácora", { skip: omitir }, async () => {
  const antes = await foto();
  const logrados = [];
  for (const [nombre, usuario, rol] of ROLES) {
    const intentos = {
      "cambiar el detalle": `update public.bitacora set detalle = '{"cambiado": true}'`,
      "cambiar la fecha": `update public.bitacora set ocurrido_en = now() - interval '1 year'`,
      "cambiar el autor": `update public.bitacora set usuario_id = '${D.auxiliar}'`,
      "borrar un registro": `delete from public.bitacora where usuario_id = '${D.admin}'`,
      "borrar todo": `delete from public.bitacora`,
      "vaciar la tabla": `truncate public.bitacora`,
      "reescribir con insert … on conflict": `insert into public.bitacora (id, usuario_id, accion) select id, usuario_id, 'subio' from public.bitacora limit 1
        on conflict (id) do update set accion = 'subio', detalle = '{"cambiado": true}'`,
    };
    for (const [que, sql] of Object.entries(intentos)) {
      const r = await como(usuario, rol, () => intentar(sql));
      // Un «0» puede ser que RLS no le deja ver la fila; un error es que la base lo rechazó. Lo demás es una falla.
      if (typeof r === "number" && r > 0) logrados.push(`${nombre}: ${que} (${r})`);
    }
  }
  assert.deepEqual(logrados, []);
  assert.equal(await foto(), antes, "La bitácora cambió");
});

test("G5: ni el dueño de la tabla (en Supabase, el SQL Editor) la modifica sin quitar antes la protección", { skip: omitir }, async () => {
  const antes = await foto();
  for (const sql of ["update public.bitacora set detalle = null", "delete from public.bitacora", "truncate public.bitacora"]) {
    const r = await intentar(sql);
    assert.match(String(r), /^error BT001$/, `${sql}: ${r}`);
  }
  assert.equal(await foto(), antes);
});

test("G5: la fecha y el autor de un registro nuevo los pone la base (no se pueden inventar)", { skip: omitir }, async () => {
  // Una fecha en el futuro haría que un «motivo» de periodo cerrado (D4) valiera para siempre.
  const r = await como(D.contador, "authenticated", async () => {
    await db.exec(`insert into public.bitacora (factura_id, accion, detalle, ocurrido_en)
      values ('${D.factura}', 'aprobo', '{"motivo_periodo_cerrado": "Motivo con fecha inventada"}', '2099-01-01')`);
    return (await db.query(`select ocurrido_en from public.bitacora where detalle ->> 'motivo_periodo_cerrado' = 'Motivo con fecha inventada'`)).rows;
  });
  // El contador no puede leer la bitácora (solo el administrador), así que se lee como dueño.
  assert.deepEqual(r, []);
  const fila = (await db.query(`select ocurrido_en, usuario_id from public.bitacora where detalle ->> 'motivo_periodo_cerrado' = 'Motivo con fecha inventada'`)).rows[0];
  assert.ok(Math.abs(new Date(fila.ocurrido_en).getTime() - Date.now()) < 60_000, `quedó con fecha ${fila.ocurrido_en}`);
  assert.equal(fila.usuario_id, D.contador);
  // Y nadie escribe a nombre de otro: si lo intenta, el registro queda a su propio nombre.
  await como(D.auxiliar, "authenticated", () =>
    db.exec(`insert into public.bitacora (usuario_id, accion, detalle) values ('${D.admin}', 'aprobo', '{"prueba": "a nombre de otro"}')`));
  const autor = (await db.query(`select usuario_id from public.bitacora where detalle ->> 'prueba' = 'a nombre de otro'`)).rows[0];
  assert.equal(autor.usuario_id, D.auxiliar);
});

test("G5: la aplicación sigue registrando y el administrador sigue leyendo la bitácora", { skip: omitir }, async () => {
  for (const [, usuario] of ROLES.slice(0, 3)) {
    const r = await como(usuario, "authenticated", () => intentar(`insert into public.bitacora (accion, detalle) values ('subio', '{"archivo": "x.xml"}')`));
    assert.equal(r, 1);
  }
  const leidas = await como(D.admin, "authenticated", () => intentar("select 1 from public.bitacora"));
  assert.ok(leidas >= 8, `el administrador ve ${leidas}`); // 3 iniciales + 2 de la prueba anterior + 3 nuevos
  const auxiliar = await como(D.auxiliar, "authenticated", () => intentar("select 1 from public.bitacora"));
  assert.equal(auxiliar, 0); // solo el administrador consulta la bitácora (02-esquema.sql)
});
