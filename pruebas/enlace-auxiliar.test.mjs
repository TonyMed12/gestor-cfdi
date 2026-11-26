// G9. Solo administrador y contador ven el enlace de envío del cliente (RNF-08): un auxiliar no puede leer el token
// ni desde la base ni desde la página. La contraseña nunca se guarda en claro (solo su hash) y solo se muestra al
// generarla.
// 1) En la base (PGlite, como G1): con cada rol, el token no se puede leer de ninguna tabla, vista ni función.
// 2) En el código: la página solo pide y muestra el enlace a administrador y contador, y la función que lee el token
//    lo vuelve a revisar por su cuenta.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const { PGlite } = await import("@electric-sql/pglite").catch(() => ({}));
const omitir = PGlite ? false : "falta instalar @electric-sql/pglite (npm ci)";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const D = { despacho: id(1), admin: id(11), contador: id(12), auxiliar: id(13), cliente: id(21) };
const TOKEN = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";

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
    insert into public.enlace_acceso (cliente_id, token, password_hash, vence_en)
      values ('${D.cliente}', '${TOKEN}', 'scrypt$00$11', now() + interval '30 days');
  `);
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
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

test("G9: desde la base, ningún usuario lee el token ni la contraseña del enlace", { skip: omitir }, async () => {
  await preparar();
  for (const [nombre, usuario, rol] of [
    ["auxiliar", D.auxiliar, "authenticated"], ["contador", D.contador, "authenticated"],
    ["administrador", D.admin, "authenticated"], ["sin sesión", null, "anon"],
  ]) {
    const r = await como(usuario, rol, async () => {
      try {
        return (await db.query("select token, password_hash from public.enlace_acceso")).rows.length;
      } catch {
        return "error";
      }
    });
    // Nadie lo lee directo de la base: la página lo pide al servidor, que revisa el rol (ver abajo).
    assert.ok(r === 0 || r === "error", `${nombre} leyó ${r} enlace(s)`);
  }
});

test("G9: el token no quedó en otra tabla, vista o función que el auxiliar pueda leer", { skip: omitir }, async () => {
  // La columna clientes.enlace_token del script 13 la quitó el 14.
  const columna = await db.query(`select 1 from information_schema.columns where table_schema = 'public' and column_name ilike '%token%' and table_name <> 'enlace_acceso'`);
  assert.deepEqual(columna.rows, []);
  // Ninguna vista lee enlace_acceso.
  const vistas = await db.query(`select viewname from pg_views where schemaname = 'public' and definition ilike '%enlace_acceso%'`);
  assert.deepEqual(vistas.rows, []);
  // Ninguna función que el auxiliar pueda llamar lee enlace_acceso.
  const funciones = await db.query(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.prosrc ilike '%enlace_acceso%' and has_function_privilege('authenticated', p.oid, 'execute')`);
  assert.deepEqual(funciones.rows, []);
  // Y el valor del token no aparece en ninguna tabla que el auxiliar sí puede leer.
  const tablas = (await db.query(`select table_name from information_schema.tables where table_schema = 'public' and table_type in ('BASE TABLE', 'VIEW')`)).rows.map((r) => r.table_name);
  const encontrado = [];
  for (const t of tablas) {
    const n = await como(D.auxiliar, "authenticated", async () => {
      try {
        return (await db.query(`select 1 from public.${t} x where x::text like '%${TOKEN}%'`)).rows.length;
      } catch {
        return 0;
      }
    });
    if (n > 0) encontrado.push(t);
  }
  assert.deepEqual(encontrado, []);
});

test("G9: la página solo pide y muestra el enlace a administrador y contador", () => {
  const pagina = readFileSync(join(RAIZ, "src", "app", "clientes", "[clienteId]", "page.tsx"), "utf8");
  assert.match(pagina, /const puedeEditar = perfil\?\.rol === "administrador" \|\| perfil\?\.rol === "contador";/);
  assert.match(pagina, /const enlace = puedeEditar \? await getEnlaceEnvio\(cliente\.id\) : null;/);
  assert.match(pagina, /\{puedeEditar && <EnlaceEnvio /);
});

test("G9: la función que lee el token revisa el rol por su cuenta, antes de leerlo", () => {
  const datos = readFileSync(join(RAIZ, "src", "lib", "datos.ts"), "utf8");
  const inicio = datos.indexOf("export async function getEnlaceEnvio");
  const cuerpo = datos.slice(inicio, datos.indexOf("\n}\n", inicio));
  const revisaRol = cuerpo.search(/yo\?\.rol !== "administrador" && yo\?\.rol !== "contador"\) return null;/);
  const leeToken = cuerpo.indexOf('from("enlace_acceso")');
  assert.ok(revisaRol > 0, "getEnlaceEnvio debe revisar el rol");
  assert.ok(revisaRol < leeToken, "el rol se revisa antes de leer el token");
});

test("G9: generar un enlace (y ver su contraseña) es solo para administrador y contador", () => {
  const acciones = readFileSync(join(RAIZ, "src", "app", "clientes", "[clienteId]", "acciones.ts"), "utf8");
  const inicio = acciones.indexOf("export async function generarEnlaceEnvio");
  const cuerpo = acciones.slice(inicio, acciones.indexOf("\nexport async function", inicio + 1));
  assert.ok(cuerpo.includes('!["administrador", "contador"].includes(yo.rol)'));
  assert.ok(cuerpo.indexOf("includes(yo.rol)") < cuerpo.indexOf("enlace_acceso"), "el rol se revisa antes de guardar");
  // La contraseña solo se guarda como hash.
  assert.ok(cuerpo.includes("password_hash: hashContrasena(contrasena)"));
});
