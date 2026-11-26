// H3. Categorías propias de cada cliente (RF-29): aparecen al corregir las facturas de su cliente y no en las de otros.
// 1) En la base (PGlite, como G1): dónde se puede usar una categoría de cliente y que no haya nombres repetidos.
// 2) En el código: la revisión ofrece y acepta solo las categorías del despacho y las del cliente de la factura;
//    claves y reglas por emisor solo usan categorías del despacho.
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
const D = {
  despacho: id(1), admin: id(11), contador: id(12), uno: id(21), dos: id(22),
  general: id(71), fletesUno: id(72), // «Gastos generales» (despacho) y «Fletes» (solo del cliente uno)
  facturaUno: id(41), facturaDos: id(42), conceptoUno: id(51), conceptoDos: id(52), clave: "01010101",
};

let db;

async function preparar() {
  db = new PGlite();
  await db.exec(readFileSync(join(RAIZ, "pruebas", "aislamiento", "supabase-simulado.sql"), "utf8"));
  const dir = join(RAIZ, "supabase");
  for (const f of readdirSync(dir).filter((f) => /^\d\d-.*\.sql$/.test(f) && !f.startsWith("99")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [D.admin]);
  const factura = (f, a, c, n) => `
    insert into public.archivo (id, cliente_id, tipo, huella_sha256, ruta_original, estado)
      values ('${a}', '${c}', 'xml', '${String(n).repeat(64).slice(0, 64)}', '${c}/${a}/f.xml', 'por_revisar');
    insert into public.factura (id, archivo_id, cliente_id, uuid_fiscal, tipo_comprobante, relacion, rfc_emisor, rfc_receptor,
      uso_cfdi, subtotal, total, emitido_en, timbrado_en)
      values ('${f}', '${a}', '${c}', '${f}', 'I', 'recibida', 'XAXX010101000', 'AAA010101AAA', 'G03', 100, 116, now(), now());`;
  await db.exec(`
    insert into public.cat_clave_prod_serv (clave, descripcion) values ('${D.clave}', 'Prueba') on conflict do nothing;
    insert into public.despacho (id, nombre, rfc) values ('${D.despacho}', 'Despacho', 'AAA010101AAA');
    insert into auth.users (id) values ('${D.admin}'), ('${D.contador}');
    insert into public.usuario (id, despacho_id, nombre, correo, rol) values
      ('${D.admin}', '${D.despacho}', 'Admin', 'a@x.mx', 'administrador'),
      ('${D.contador}', '${D.despacho}', 'Contador', 'c@x.mx', 'contador');
    insert into public.clientes (id, despacho_id, razon_social, rfc) values
      ('${D.uno}', '${D.despacho}', 'Cliente uno', 'AAA010101AAA'), ('${D.dos}', '${D.despacho}', 'Cliente dos', 'BBB010101BBB');
    insert into public.categoria (id, despacho_id, cliente_id, nombre) values
      ('${D.general}', '${D.despacho}', null, 'Gastos generales'), ('${D.fletesUno}', '${D.despacho}', '${D.uno}', 'Fletes');
    ${factura(D.facturaUno, id(31), D.uno, "a")}
    ${factura(D.facturaDos, id(32), D.dos, "b")}
    insert into public.concepto (id, factura_id, clave_prod_serv, descripcion, cantidad, importe) values
      ('${D.conceptoUno}', '${D.facturaUno}', '${D.clave}', 'Flete', 1, 100),
      ('${D.conceptoDos}', '${D.facturaDos}', '${D.clave}', 'Flete', 1, 100);
  `);
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
}

async function contador(sql) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [D.contador]);
  await db.exec("set role authenticated");
  try {
    const r = await db.query(sql);
    return r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0);
  } catch (e) {
    return `error ${e.code ?? ""}`.trim();
  } finally {
    await db.exec("reset role");
  }
}

test("H3: la categoría de un cliente sirve en sus facturas y no en las de otro cliente", { skip: omitir }, async () => {
  await preparar();
  assert.equal(await contador(`update public.concepto set categoria_id = '${D.fletesUno}' where id = '${D.conceptoUno}'`), 1);
  assert.match(String(await contador(`update public.concepto set categoria_id = '${D.fletesUno}' where id = '${D.conceptoDos}'`)), /^error/);
  // Las del despacho sirven en todos.
  assert.equal(await contador(`update public.concepto set categoria_id = '${D.general}' where id = '${D.conceptoDos}'`), 1);
});

test("H3: claves del SAT y reglas por emisor solo usan categorías del despacho", { skip: omitir }, async () => {
  assert.match(String(await contador(`insert into public.clave_categoria (despacho_id, clave, categoria_id) values ('${D.despacho}', '${D.clave}', '${D.fletesUno}')`)), /^error/);
  assert.match(String(await contador(`insert into public.regla_emisor (despacho_id, rfc, categoria_id) values ('${D.despacho}', 'XEXX010101000', '${D.fletesUno}')`)), /^error/);
  assert.equal(await contador(`insert into public.clave_categoria (despacho_id, clave, categoria_id) values ('${D.despacho}', '${D.clave}', '${D.general}')`), 1);
  assert.equal(await contador(`insert into public.regla_emisor (despacho_id, rfc, categoria_id) values ('${D.despacho}', 'XEXX010101000', '${D.general}')`), 1);
  assert.match(String(await contador(`update public.clave_categoria set categoria_id = '${D.fletesUno}' where clave = '${D.clave}'`)), /^error/);
});

test("H3: un cliente no ve dos categorías con el mismo nombre", { skip: omitir }, async () => {
  const nueva = (cliente, nombre) =>
    contador(`insert into public.categoria (despacho_id, cliente_id, nombre) values ('${D.despacho}', ${cliente ? `'${cliente}'` : "null"}, '${nombre}')`);
  // De cliente con el nombre de una del despacho (sin importar mayúsculas ni espacios): no.
  assert.equal(await nueva(D.uno, "  gastos GENERALES "), "error CT001");
  // Del despacho con el nombre de una de cliente: no (ese cliente vería dos).
  assert.equal(await nueva(null, "Fletes"), "error CT001");
  // Dos del mismo cliente: no.
  assert.equal(await nueva(D.uno, "FLETES"), "error CT001");
  // Otro cliente sí puede tener su propia «Fletes»: cada cliente solo ve la suya.
  assert.equal(await nueva(D.dos, "Fletes"), 1);
  // Renombrar a un nombre libre funciona; a uno ocupado, no.
  assert.equal(await contador(`update public.categoria set nombre = 'Fletes foráneos' where id = '${D.fletesUno}'`), 1);
  assert.equal(await contador(`update public.categoria set nombre = 'Gastos generales' where id = '${D.fletesUno}'`), "error CT001");
});

test("H3: la revisión ofrece y acepta solo las categorías del despacho y las del cliente de la factura", () => {
  const datos = leer("src", "lib", "datos.ts");
  assert.ok(datos.includes("`cliente_id.is.null,cliente_id.eq.${clienteId}`"), "getCategorias filtra por cliente");
  assert.ok(leer("src", "app", "revision", "[facturaId]", "page.tsx").includes("getCategorias(factura.clienteId)"));
  const acciones = leer("src", "app", "revision", "[facturaId]", "acciones.ts");
  assert.ok(acciones.includes("await getCategorias(factura.clienteId)"));
  assert.ok(acciones.includes('if (!permitidas.has(categoriaId)) return { error: "Categoría no válida." };'));
  // Claves, reglas por emisor y la pantalla de categorías del despacho solo muestran las del despacho.
  for (const pagina of ["claves", "reglas", "categorias"]) {
    assert.match(leer("src", "app", pagina, "page.tsx"), /getCategorias\(\)/, pagina);
  }
});

test("H3: guardar claves, reglas y categorías revisa antes, con mensajes claros", () => {
  const claves = leer("src", "app", "claves", "acciones.ts");
  assert.equal((claves.match(/await esCategoriaDelDespacho\(/g) ?? []).length, 2); // una clave y varias a la vez
  assert.ok(leer("src", "app", "reglas", "acciones.ts").includes('.is("cliente_id", null)'));
  assert.ok(leer("src", "app", "categorias", "acciones.ts").includes("Un cliente ya tiene una categoría propia con ese nombre"));
  assert.ok(leer("src", "app", "clientes", "[clienteId]", "acciones.ts").includes("Ya hay una categoría del despacho con ese nombre"));
});
