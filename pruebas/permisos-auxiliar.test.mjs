// G7. Permisos del auxiliar (RF-46): captura y consulta, pero no aprueba, no cierra, no ve la bitácora ni cambia
// clientes. Cada acción prohibida falla; las permitidas funcionan.
// 1) En la base (PGlite, como G1): se entra como auxiliar y se intenta cada acción.
// 2) En el servidor: cada acción está clasificada por quién puede usarla, y las restringidas revisan el rol al inicio
//    con un mensaje claro. Una acción nueva sin clasificar hace fallar la prueba.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const { PGlite } = await import("@electric-sql/pglite").catch(() => ({}));
const omitir = PGlite ? false : "falta instalar @electric-sql/pglite (npm ci)";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const D = {
  despacho: id(1), admin: id(11), contador: id(12), auxiliar: id(13), cliente: id(21), archivo: id(31), archivo2: id(32),
  factura: id(41), concepto: id(51), categoria: id(71), categoria2: id(72), clave: "01010101",
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
  const ruta = (a) => `${D.cliente}/${a}/f.xml`;
  await db.exec(`
    insert into public.cat_clave_prod_serv (clave, descripcion) values ('${D.clave}', 'Prueba') on conflict do nothing;
    insert into public.despacho (id, nombre, rfc) values ('${D.despacho}', 'Despacho', 'AAA010101AAA');
    insert into auth.users (id) values ('${D.admin}'), ('${D.contador}'), ('${D.auxiliar}');
    insert into public.usuario (id, despacho_id, nombre, correo, rol) values
      ('${D.admin}', '${D.despacho}', 'Admin', 'a@x.mx', 'administrador'),
      ('${D.contador}', '${D.despacho}', 'Contador', 'c@x.mx', 'contador'),
      ('${D.auxiliar}', '${D.despacho}', 'Auxiliar', 'x@x.mx', 'auxiliar');
    insert into public.clientes (id, despacho_id, razon_social, rfc) values ('${D.cliente}', '${D.despacho}', 'Cliente', 'AAA010101AAA');
    insert into public.categoria (id, despacho_id, nombre) values ('${D.categoria}', '${D.despacho}', 'Uno'), ('${D.categoria2}', '${D.despacho}', 'Dos');
    insert into public.archivo (id, cliente_id, tipo, huella_sha256, ruta_original, estado) values
      ('${D.archivo}', '${D.cliente}', 'xml', '${"a".repeat(64)}', '${ruta(D.archivo)}', 'por_revisar'),
      ('${D.archivo2}', '${D.cliente}', 'xml', '${"b".repeat(64)}', '${ruta(D.archivo2)}', 'recibido');
    insert into public.factura (id, archivo_id, cliente_id, uuid_fiscal, tipo_comprobante, relacion, rfc_emisor, rfc_receptor,
      uso_cfdi, subtotal, total, emitido_en, timbrado_en)
      values ('${D.factura}', '${D.archivo}', '${D.cliente}', 'X', 'I', 'recibida', 'XAXX010101000', 'AAA010101AAA', 'G03', 100, 116, now(), now());
    insert into public.concepto (id, factura_id, clave_prod_serv, descripcion, cantidad, importe, categoria_id)
      values ('${D.concepto}', '${D.factura}', '${D.clave}', 'Concepto', 1, 100, '${D.categoria}');
    insert into public.regla_emisor (despacho_id, rfc, categoria_id) values ('${D.despacho}', 'XAXX010101000', '${D.categoria}');
    insert into public.bitacora (accion) values ('subio');
    insert into storage.objects (bucket_id, name) values ('facturas', '${ruta(D.archivo)}');
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

async function intentar(sql) {
  try {
    const r = await db.query(sql);
    return r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0);
  } catch {
    return "error";
  }
}

// Lo que el auxiliar NO puede hacer (RF-46). Cada intento debe fallar o no afectar nada.
const PROHIBIDAS = {
  "aprobar una factura": `update public.factura set estado_revision = 'clasificado' where id = '${D.factura}'`,
  "rechazar una factura": `update public.factura set estado_revision = 'excluido', motivo_exclusion = 'x' where id = '${D.factura}'`,
  "marcar la deducibilidad": `update public.factura set deducible = false where id = '${D.factura}'`,
  "corregir la categoría de un concepto": `update public.concepto set categoria_id = '${D.categoria2}' where id = '${D.concepto}'`,
  "guardar el estado ante el SAT": `update public.factura set estado_sat = 'cancelada' where id = '${D.factura}'`,
  "cerrar un periodo": `update public.periodo set estado = 'cerrado' where cliente_id = '${D.cliente}'`,
  "crear un periodo": `insert into public.periodo (cliente_id, mes_anio) values ('${D.cliente}', '2020-01')`,
  "ver la bitácora": `select 1 from public.bitacora`,
  "cambiar un cliente": `update public.clientes set razon_social = 'Otro' where id = '${D.cliente}'`,
  "desactivar un cliente": `update public.clientes set activo = false where id = '${D.cliente}'`,
  "crear un cliente": `insert into public.clientes (despacho_id, razon_social, rfc) values ('${D.despacho}', 'Nuevo', 'XEXX010101000')`,
  "borrar un cliente": `delete from public.clientes where id = '${D.cliente}'`,
  "crear una categoría": `insert into public.categoria (despacho_id, nombre) values ('${D.despacho}', 'Tres')`,
  "cambiar una categoría": `update public.categoria set nombre = 'Otra' where id = '${D.categoria}'`,
  "asignar una clave del SAT": `insert into public.clave_categoria (despacho_id, clave, categoria_id) values ('${D.despacho}', '${D.clave}', '${D.categoria}')`,
  "crear una regla por emisor": `insert into public.regla_emisor (despacho_id, rfc, categoria_id) values ('${D.despacho}', 'XEXX010101000', '${D.categoria}')`,
  "cambiar una regla por emisor": `update public.regla_emisor set categoria_id = '${D.categoria2}' where despacho_id = '${D.despacho}'`,
  "borrar una regla por emisor": `delete from public.regla_emisor where despacho_id = '${D.despacho}'`,
  "crear una regla por cliente": `insert into public.regla (cliente_id, condicion, categoria_id) values ('${D.cliente}', '{}', '${D.categoria}')`,
  "crear un usuario": `insert into public.usuario (id, despacho_id, nombre, correo, rol) values ('${id(99)}', '${D.despacho}', 'Yo', 'y@x.mx', 'administrador')`,
  "subirse de rol": `update public.usuario set rol = 'administrador' where id = '${D.auxiliar}'`,
  "desactivar a otro usuario": `update public.usuario set activo = false where id = '${D.contador}'`,
  "ver el enlace del cliente": `select 1 from public.enlace_acceso`,
  "borrar un archivo original": `delete from storage.objects where name like '${D.cliente}/%'`,
  "borrar una factura": `delete from public.factura where id = '${D.factura}'`,
};

// Lo que el auxiliar SÍ puede hacer: capturar y consultar.
const PERMITIDAS = {
  "ver los clientes": [`select 1 from public.clientes`, 1],
  "ver las facturas": [`select 1 from public.factura`, 1],
  "ver los conceptos": [`select 1 from public.concepto`, 1],
  "ver los periodos": [`select 1 from public.periodo`, 1],
  "ver las categorías": [`select 1 from public.categoria`, 2],
  "ver los archivos originales": [`select 1 from storage.objects`, 1],
  "registrar un archivo subido": [`insert into public.archivo (cliente_id, tipo, huella_sha256, ruta_original) values ('${D.cliente}', 'xml', '${"c".repeat(64)}', '${D.cliente}/${id(33)}/n.xml')`, 1],
  "subir el archivo original": [`insert into storage.objects (bucket_id, name) values ('facturas', '${D.cliente}/${id(33)}/n.xml')`, 1],
  "empezar a leer un archivo recibido": [`update public.archivo set estado = 'leyendo' where id = '${D.archivo2}'`, 1],
  "registrar en la bitácora lo que subió": [`insert into public.bitacora (accion, detalle) values ('subio', '{"archivo": "n.xml"}')`, 1],
};

test("G7: en la base, cada acción prohibida para el auxiliar falla", { skip: omitir }, async () => {
  await preparar();
  const foto = async () =>
    JSON.stringify(await Promise.all(["factura", "concepto", "periodo", "clientes", "categoria", "clave_categoria", "regla_emisor", "regla", "usuario"].map(
      async (t) => (await db.query(`select * from public.${t} order by 1`)).rows,
    )));
  const antes = await foto();
  const logradas = [];
  for (const [que, sql] of Object.entries(PROHIBIDAS)) {
    const n = await como(D.auxiliar, () => intentar(sql));
    if (n !== 0 && n !== "error") logradas.push(`${que} (${n})`);
  }
  assert.deepEqual(logradas, []);
  assert.equal(await foto(), antes, "Algo cambió");
  assert.equal((await db.query("select count(*)::int n from storage.objects")).rows[0].n, 1);
});

test("G7: en la base, lo permitido al auxiliar funciona (captura y consulta)", { skip: omitir }, async () => {
  const fallaron = [];
  for (const [que, [sql, esperado]] of Object.entries(PERMITIDAS)) {
    const n = await como(D.auxiliar, () => intentar(sql));
    if (n !== esperado) fallaron.push(`${que}: ${n} (se esperaba ${esperado})`);
  }
  assert.deepEqual(fallaron, []);
});

test("G7: lo que el auxiliar no puede hacer, el contador sí (la prueba no bloquea de más)", { skip: omitir }, async () => {
  for (const sql of [PROHIBIDAS["corregir la categoría de un concepto"], PROHIBIDAS["cambiar un cliente"], PROHIBIDAS["crear una categoría"]]) {
    assert.equal(await como(D.contador, () => intentar(sql)), 1, sql);
  }
  assert.ok((await como(D.admin, () => intentar("select 1 from public.bitacora"))) >= 2); // el administrador ve la bitácora
});

// ---------- Acciones del servidor ----------

// Quién puede usar cada acción. "decisor" = administrador o contador; "personal" = también el auxiliar;
// "administrador" = solo él; "enlace" = el cliente con su enlace (sin cuenta).
const ACCIONES = {
  "src/app/categorias/acciones.ts": { guardarCategoria: "decisor" },
  "src/app/claves/acciones.ts": { guardarClaveCategoria: "decisor", guardarClavesCategoria: "decisor" },
  "src/app/clientes/[clienteId]/acciones.ts": {
    procesarXml: "personal", reconsultarSat: "decisor", reintentarLectura: "personal", generarEnlaceEnvio: "decisor",
    subirXmlPorEnlace: "enlace", subirAEntrada: "personal", urlArchivo: "personal", actualizarCliente: "decisor",
    guardarCategoriaCliente: "decisor", reconsultarPeriodo: "decisor", procesarDocumentoArchivo: "personal",
  },
  "src/app/enviar/[token]/acciones.ts": { desbloquearEnlace: "enlace" },
  "src/app/reglas/acciones.ts": { guardarReglaEmisor: "decisor", eliminarReglaEmisor: "decisor" },
  "src/app/resumen/acciones.ts": { cerrarPeriodo: "decisor" },
  "src/app/revision/[facturaId]/acciones.ts": {
    aprobarFactura: "decisor", aprobarFacturasEnLote: "decisor", guardarDeducible: "decisor", rechazarFactura: "decisor",
  },
  "src/app/usuarios/acciones.ts": { crearUsuario: "administrador", cambiarEstadoUsuario: "administrador" },
};
// Cómo se ve, en el código, que una acción revisa el rol al inicio (directo o con su función de apoyo).
const REVISA = {
  decisor: /\["administrador", "contador"\]|rolDecisor\(|permisoDecidir\(|personaDecisora\(|aprobar\(|rolEnSesion\(/,
  administrador: /administradorActual\(/,
};

function accionesDelServidor() {
  const archivos = [];
  const recorrer = (dir) => {
    for (const n of readdirSync(dir)) {
      const r = join(dir, n);
      if (statSync(r).isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(n) && /^["']use server["']/m.test(readFileSync(r, "utf8"))) archivos.push(r);
    }
  };
  recorrer(join(RAIZ, "src", "app"));
  return Object.fromEntries(archivos.map((r) => {
    const texto = readFileSync(r, "utf8");
    const nombres = [...texto.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
    // Cuerpo de cada acción: desde su declaración hasta la siguiente función de primer nivel.
    const cuerpos = Object.fromEntries(nombres.map((n) => {
      const inicio = texto.indexOf(`export async function ${n}`);
      const siguiente = texto.slice(inicio + 1).search(/^(export )?(async )?function /m);
      return [n, texto.slice(inicio, siguiente === -1 ? undefined : inicio + 1 + siguiente)];
    }));
    return [relative(RAIZ, r).replace(/\\/g, "/"), cuerpos];
  }));
}

test("G7: cada acción del servidor está clasificada por quién puede usarla", () => {
  const encontradas = Object.fromEntries(Object.entries(accionesDelServidor()).map(([f, c]) => [f, Object.keys(c).sort()]));
  const esperadas = Object.fromEntries(Object.entries(ACCIONES).map(([f, c]) => [f, Object.keys(c).sort()]));
  assert.deepEqual(encontradas, esperadas, "Acción nueva o renombrada: clasifícala en ACCIONES");
});

test("G7: las acciones de administrador y contador revisan el rol al inicio, con un mensaje claro", () => {
  const acciones = accionesDelServidor();
  const sinRevisar = [];
  for (const [archivo, cuerpos] of Object.entries(acciones)) {
    for (const [nombre, cuerpo] of Object.entries(cuerpos)) {
      const quien = ACCIONES[archivo]?.[nombre];
      if (REVISA[quien] && !REVISA[quien].test(cuerpo)) sinRevisar.push(`${archivo}: ${nombre}`);
    }
  }
  assert.deepEqual(sinRevisar, []);
  // Los mensajes dicen quién sí puede.
  const todo = Object.keys(ACCIONES).map((f) => readFileSync(join(RAIZ, f), "utf8")).join("\n");
  for (const mensaje of [
    "Solo el administrador o el contador pueden clasificar facturas.",
    "Solo el administrador o el contador pueden aprobar facturas.",
    "Solo el administrador o el contador pueden cerrar un periodo.",
    "Solo el administrador o el contador pueden hacer esto.",
    "No tienes permiso para administrar usuarios.",
  ]) assert.ok(todo.includes(mensaje), mensaje);
});
