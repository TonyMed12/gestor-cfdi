// H2. Editar y desactivar clientes: cambiar la razón social y desactivar un cliente; el desactivado no recibe facturas
// nuevas (no aparece en el reparto de la bandeja de entrada ni acepta envíos por su enlace).
// 1) En la base (PGlite, como G1): quién puede editar y desactivar, y que una razón social vacía no se guarda.
// 2) En el código: el reparto solo usa clientes activos, y el enlace revisa al cliente antes de recibir nada.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const { PGlite } = await import("@electric-sql/pglite").catch(() => ({}));
const omitir = PGlite ? false : "falta instalar @electric-sql/pglite (npm ci)";
const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), "utf8");

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const D = { despacho: id(1), admin: id(11), contador: id(12), auxiliar: id(13), cliente: id(21), otro: id(22) };

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
    insert into public.clientes (id, despacho_id, razon_social, rfc) values
      ('${D.cliente}', '${D.despacho}', 'Cliente uno', 'AAA010101AAA'),
      ('${D.otro}', '${D.despacho}', 'Cliente dos', 'BBB010101BBB');
    insert into public.enlace_acceso (cliente_id, token, vence_en) values ('${D.cliente}', 'x', now() + interval '1 day');
  `);
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
}

async function como(usuario, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const intentar = async (sql) => {
  try {
    return (await db.query(sql)).affectedRows ?? 0;
  } catch {
    return "error";
  }
};
const cliente = async (cid) => (await db.query(`select razon_social, activo from public.clientes where id = '${cid}'`)).rows[0];

test("H2: el contador cambia la razón social y desactiva y reactiva un cliente", { skip: omitir }, async () => {
  await preparar();
  assert.equal(await como(D.contador, () => intentar(`update public.clientes set razon_social = 'Cliente uno SA de CV' where id = '${D.cliente}'`)), 1);
  assert.equal(await como(D.contador, () => intentar(`update public.clientes set activo = false where id = '${D.cliente}'`)), 1);
  assert.deepEqual(await cliente(D.cliente), { razon_social: "Cliente uno SA de CV", activo: false });
  assert.equal(await como(D.admin, () => intentar(`update public.clientes set activo = true where id = '${D.cliente}'`)), 1);
  assert.equal((await cliente(D.cliente)).activo, true);
});

test("H2: el auxiliar no edita ni desactiva clientes (G7)", { skip: omitir }, async () => {
  for (const sql of [
    `update public.clientes set razon_social = 'Otro nombre' where id = '${D.cliente}'`,
    `update public.clientes set activo = false where id = '${D.cliente}'`,
  ]) {
    const r = await como(D.auxiliar, () => intentar(sql));
    assert.ok(r === 0 || r === "error", sql);
  }
  assert.deepEqual(await cliente(D.cliente), { razon_social: "Cliente uno SA de CV", activo: true });
});

test("H2: una razón social vacía no se guarda (la base lo rechaza)", { skip: omitir }, async () => {
  assert.equal(await como(D.contador, () => intentar(`update public.clientes set razon_social = '   ' where id = '${D.cliente}'`)), "error");
});

test("H2: el enlace puede saber si su cliente está activo (la relación existe en la base)", { skip: omitir }, async () => {
  // buscarAcceso pide enlace_acceso con clientes(activo): necesita la llave foránea hacia clientes.
  const fk = await db.query(`select 1 from pg_constraint where conrelid = 'public.enlace_acceso'::regclass and contype = 'f'
    and confrelid = 'public.clientes'::regclass`);
  assert.equal(fk.rows.length, 1);
});

test("H2: la bandeja de entrada solo reparte a clientes activos, en las tres vías (XML, PDF y escaneo)", () => {
  const acciones = leer("src", "app", "clientes", "[clienteId]", "acciones.ts");
  const funcion = acciones.slice(acciones.indexOf("async function clientesPorRfc"), acciones.indexOf("export async function subirAEntrada"));
  assert.match(funcion, /\.eq\("activo", true\)/);
  const reparto = acciones.slice(acciones.indexOf("export async function subirAEntrada"), acciones.indexOf("export async function urlArchivo"));
  // Los clientes a los que se reparte salen siempre de clientesPorRfc, nunca de otra consulta.
  assert.equal((reparto.match(/clientesPorRfc\(/g) ?? []).length, 3);
  assert.ok(!/from\("clientes"\)/.test(reparto));
});

test("H2: el enlace de un cliente desactivado no pide contraseña ni recibe archivos", () => {
  const enlace = leer("src", "lib", "enlace.ts");
  assert.match(enlace, /clientes\(activo\)/);
  // En cada entrada del enlace, la revisión del cliente va antes de la contraseña o de guardar.
  const revisar = (texto, inicio, antesDe) => {
    const cuerpo = texto.slice(texto.indexOf(inicio));
    const i = cuerpo.indexOf("cliente_activo");
    return i > 0 && i < cuerpo.indexOf(antesDe);
  };
  const desbloquear = leer("src", "app", "enviar", "[token]", "acciones.ts");
  assert.ok(revisar(desbloquear, "export async function desbloquearEnlace", "contrasenaCoincide("), "desbloquearEnlace");
  const subir = leer("src", "app", "clientes", "[clienteId]", "acciones.ts");
  assert.ok(revisar(subir, "export async function subirXmlPorEnlace", "guardarXmlDeCliente("), "subirXmlPorEnlace");
  const pagina = leer("src", "app", "enviar", "[token]", "page.tsx");
  assert.ok(revisar(pagina, "export default async function", "<DesbloquearForm"), "página del enlace");
});
