import type { Cliente, Concepto, Factura, Impuesto } from "./types";
import { supabaseServidor } from "./supabase-servidor";
import { supabaseAdmin } from "./supabase-admin";
import {
  categoriaDeIngresoDeClave,
  categoriaSugeridaDeClave,
  elegirCategoria,
  esCategoriaDeIngreso,
} from "./categorias-por-defecto";
import { REGLAS_BASE } from "./reglas-base-claves";

type FilaCliente = {
  id: string;
  razon_social: string;
  rfc: string;
  sin_leer?: number;
  por_revisar?: number;
  con_error?: number;
};

// Convierte las columnas de la base (razon_social) a los campos de la app (razonSocial).
// Los contadores vienen de la vista resumen_cliente (script 08); "faltantes" aún no se calcula.
const aCliente = (f: FilaCliente): Cliente => ({
  id: f.id,
  razonSocial: f.razon_social,
  rfc: f.rfc,
  sinLeer: Number(f.sin_leer ?? 0),
  porRevisar: Number(f.por_revisar ?? 0),
  conError: Number(f.con_error ?? 0),
  faltantes: 0,
});

export type Perfil = { id: string; nombre: string; rol: string; despacho: string };

// Datos de la persona en sesión; es undefined si no tiene fila en la tabla usuario.
export async function getPerfil(): Promise<Perfil | undefined> {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;
  const { data } = await supabase
    .from("usuario")
    .select("nombre, rol, despacho(nombre)")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return undefined;
  const despacho = data.despacho as unknown as { nombre: string } | null;
  return { id: user.id, nombre: data.nombre, rol: data.rol, despacho: despacho?.nombre ?? "" };
}

export type UsuarioDespacho = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  activo: boolean;
};

export async function getUsuarios(): Promise<UsuarioDespacho[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, correo, rol, activo")
    .order("nombre");
  if (error) throw new Error(`No se pudieron leer los usuarios: ${error.message}`);
  return data;
}

export type ArchivoCliente = {
  id: string;
  nombre: string;
  ruta: string;
  tipo: string;
  estado: string;
  recibidoEn: string;
  motivoError: string | null;
  factura: {
    uuid: string;
    emisor: string;
    receptor: string;
    total: string;
    moneda: string;
    estadoSat: string | null;
  } | null;
};

type FilaFactura = {
  estado_sat: string | null;
  uuid_fiscal: string;
  rfc_emisor: string;
  nombre_emisor: string | null;
  rfc_receptor: string;
  nombre_receptor: string | null;
  total: string;
  moneda: string;
};

// Supabase devuelve una relación como lista si puede haber varias filas, o como objeto (o null)
// si es de uno a uno. factura.archivo_id es único desde el script 08, así que llega como objeto.
const unaFila = <T>(relacion: T | T[] | null | undefined): T | null =>
  Array.isArray(relacion) ? (relacion[0] ?? null) : (relacion ?? null);

export async function getArchivos(clienteId: string): Promise<ArchivoCliente[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("archivo")
    .select(
      "id, tipo, estado, ruta_original, recibido_en, motivo_error, factura(uuid_fiscal, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor, total, moneda, estado_sat)",
    )
    .eq("cliente_id", clienteId)
    .order("recibido_en", { ascending: false });
  if (error) throw new Error(`No se pudieron leer los archivos: ${error.message}`);
  return data.map((a) => {
    const f = unaFila(a.factura as FilaFactura | FilaFactura[] | null);
    return {
      id: a.id,
      nombre: a.ruta_original.split("/").pop() ?? a.ruta_original,
      ruta: a.ruta_original,
      tipo: a.tipo,
      estado: a.estado,
      recibidoEn: a.recibido_en,
      motivoError: a.motivo_error,
      factura: f && {
        uuid: f.uuid_fiscal,
        emisor: f.nombre_emisor ?? f.rfc_emisor,
        receptor: f.nombre_receptor ?? f.rfc_receptor,
        total: f.total,
        moneda: f.moneda,
        estadoSat: f.estado_sat,
      },
    };
  });
}

type FilaSat = { estado_sat: string | null; fecha_consulta_sat: string | null };

// Archivo de un cliente y su contenido original (el XML tal como se subió).
export async function getArchivoParaVer(clienteId: string, archivoId: string) {
  const supabase = await supabaseServidor();
  const { data: archivo } = await supabase
    .from("archivo")
    .select("id, tipo, estado, motivo_error, ruta_original, recibido_en, factura(estado_sat, fecha_consulta_sat)")
    .eq("id", archivoId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!archivo) return undefined;
  const { data: descarga } = await supabase.storage.from("facturas").download(archivo.ruta_original);
  const f = unaFila(archivo.factura as FilaSat | FilaSat[] | null);
  return {
    archivo,
    xml: descarga ? await descarga.text() : null,
    sat: f ? { estado: f.estado_sat, consultadoEn: f.fecha_consulta_sat } : null,
  };
}

// Descripciones de los catálogos del SAT para las claves que aparecen en una factura.
export async function getDescripcionesSat(usos: string[], regimenes: string[]) {
  const supabase = await supabaseServidor();
  const [uso, regimen] = await Promise.all([
    supabase.from("cat_uso_cfdi").select("clave, descripcion").in("clave", usos),
    supabase.from("cat_regimen_fiscal").select("clave, descripcion").in("clave", regimenes),
  ]);
  const aMapa = (filas: { clave: string; descripcion: string }[] | null) =>
    Object.fromEntries((filas ?? []).map((f) => [f.clave, f.descripcion]));
  return { uso: aMapa(uso.data), regimen: aMapa(regimen.data) };
}

export async function getClientes(): Promise<Cliente[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("resumen_cliente")
    .select("id, razon_social, rfc, sin_leer, por_revisar, con_error")
    .order("razon_social");
  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`);
  return data.map(aCliente);
}

export async function getCliente(id: string): Promise<Cliente | undefined> {
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("clientes")
    .select("id, razon_social, rfc, activo")
    .eq("id", id)
    .maybeSingle();
  return data ? { ...aCliente(data), activo: data.activo } : undefined;
}

// Facturas leídas de la base, con sus conceptos e impuestos (RLS limita a tu despacho).
const SELECCION_FACTURA =
  "id, cliente_id, uuid_fiscal, tipo_comprobante, relacion, rfc_emisor, nombre_emisor, rfc_receptor, nombre_receptor, uso_cfdi, forma_pago, metodo_pago, regimen_receptor, fuente, subtotal, total, moneda, estado_sat, fecha_consulta_sat, estado_revision, motivo_exclusion, emitido_en, timbrado_en, concepto(id, clave_prod_serv, descripcion, cantidad, importe, objeto_impuesto, categoria_id, categoria(nombre), impuesto(tipo, impuesto, tasa, importe))";

type FilaFacturaCompleta = {
  id: string;
  cliente_id: string;
  uuid_fiscal: string;
  tipo_comprobante: string;
  relacion: string;
  rfc_emisor: string;
  nombre_emisor: string | null;
  rfc_receptor: string;
  nombre_receptor: string | null;
  uso_cfdi: string;
  forma_pago: string | null;
  regimen_receptor: string | null;
  fuente: string;
  metodo_pago: string | null;
  subtotal: string;
  total: string;
  moneda: string;
  estado_sat: string;
  fecha_consulta_sat: string;
  estado_revision: string;
  motivo_exclusion: string | null;
  emitido_en: string;
  timbrado_en: string;
  concepto: {
    id: string;
    clave_prod_serv: string;
    descripcion: string;
    cantidad: string;
    importe: string;
    objeto_impuesto: string | null;
    categoria_id: string | null;
    categoria: { nombre: string } | null;
    impuesto: { tipo: string; impuesto: string; tasa: string; importe: string }[];
  }[];
};

// shortcut: prioridad fija en "normal" y sin sugerencia de IA; se llenan con S3-05 y S3-06.
const aFactura = (f: FilaFacturaCompleta): Factura => ({
  id: f.id,
  clienteId: f.cliente_id,
  uuidFiscal: f.uuid_fiscal,
  tipoComprobante: f.tipo_comprobante as Factura["tipoComprobante"],
  relacion: f.relacion as Factura["relacion"],
  emisorNombre: f.nombre_emisor ?? f.rfc_emisor,
  emisorRfc: f.rfc_emisor,
  receptorNombre: f.nombre_receptor ?? f.rfc_receptor,
  receptorRfc: f.rfc_receptor,
  usoCfdi: f.uso_cfdi,
  formaPago: f.forma_pago,
  regimenReceptor: f.regimen_receptor,
  fuente: f.fuente === "pdf" ? "pdf" : "xml",
  metodoPago: f.metodo_pago as Factura["metodoPago"],
  moneda: f.moneda,
  subtotal: Number(f.subtotal),
  total: Number(f.total),
  fechaEmision: f.emitido_en,
  fechaTimbrado: f.timbrado_en,
  fechaConsultaSat: f.fecha_consulta_sat,
  estadoSat: f.estado_sat as Factura["estadoSat"],
  estadoRevision: f.estado_revision as Factura["estadoRevision"],
  motivoExclusion: f.motivo_exclusion ?? undefined,
  prioridad: "normal",
  categoriaPropuesta: "Sin clasificar",
  conceptos: f.concepto.map(
    (c): Concepto => ({
      id: c.id,
      categoriaGuardada: c.categoria?.nombre ?? null,
      claveProdServ: c.clave_prod_serv,
      descripcion: c.descripcion,
      cantidad: Number(c.cantidad),
      importe: Number(c.importe),
      impuestos: c.impuesto.map(
        (i): Impuesto => ({
          tipo: i.tipo as Impuesto["tipo"],
          impuesto: i.impuesto as Impuesto["impuesto"],
          tasa: Number(i.tasa),
          importe: Number(i.importe),
        }),
      ),
    }),
  ),
});

export async function getFacturasPorRevisar(): Promise<Factura[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("factura")
    .select(SELECCION_FACTURA)
    .eq("estado_revision", "por_revisar")
    .order("emitido_en", { ascending: false });
  if (error) throw new Error(`No se pudieron leer las facturas: ${error.message}`);
  const [porClave, porEmisor, todas] = await Promise.all([
    mapaClaveCategoria(),
    mapaReglasEmisor(),
    supabase.from("factura").select("cliente_id, relacion, rfc_emisor, rfc_receptor").neq("estado_revision", "excluido"),
  ]);
  // Cuántas facturas (no excluidas) tiene cada cliente con cada contraparte: si es 1, el emisor es nuevo.
  const conteo = new Map<string, number>();
  for (const t of todas.data ?? []) {
    const clave = `${t.cliente_id}|${t.relacion === "recibida" ? t.rfc_emisor : t.rfc_receptor}`;
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  const facturas = (data as unknown as FilaFacturaCompleta[]).map((f) => {
    const factura = conCategoria(aFactura(f), porClave, porEmisor);
    const contraparte = factura.relacion === "recibida" ? factura.emisorRfc : factura.receptorRfc;
    factura.emisorNuevo = conteo.get(`${f.cliente_id}|${contraparte}`) === 1;
    // Prioridad (RF-31): primero lo que bloquea el resumen, luego lo que conviene mirar.
    const sinCategoria = factura.conceptos.some((c) => !c.categoria);
    if (sinCategoria) {
      factura.prioridad = "alta";
      factura.motivoPrioridad = "Hay conceptos sin categoría";
    } else if (factura.emisorNuevo) {
      factura.prioridad = "alta";
      factura.motivoPrioridad = "Primera factura de este proveedor";
    }
    return factura;
  });
  // Stable sort: las de prioridad alta primero; dentro de cada grupo, las más recientes primero.
  return facturas.sort((a, b) => Number(b.prioridad === "alta") - Number(a.prioridad === "alta"));
}

// Clave → nombre de la categoría que el contador asignó en este despacho.
async function mapaClaveCategoria(): Promise<Map<string, string>> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.from("clave_categoria").select("clave, categoria(nombre)");
  if (error) throw new Error(`No se pudo leer el mapeo de claves: ${error.message}`);
  return new Map(
    data.map((m) => [m.clave as string, (m.categoria as unknown as { nombre: string }).nombre]),
  );
}

// RFC → nombre de la categoría de la regla por emisor de este despacho.
async function mapaReglasEmisor(): Promise<Map<string, string>> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.from("regla_emisor").select("rfc, categoria(nombre)");
  if (error) throw new Error(`No se pudieron leer las reglas por emisor: ${error.message}`);
  return new Map(
    data.map((r) => [r.rfc as string, (r.categoria as unknown as { nombre: string }).nombre]),
  );
}

// Cada concepto se clasifica solo, con el orden de elegirCategoria (categorias-por-defecto.ts):
// clave asignada a mano, regla por emisor, regla base, sugerencia por la clave y sin clasificar,
// tomando solo categorías de ingreso en emitidas y de gasto en recibidas.
function conCategoria(
  factura: Factura,
  porClave: Map<string, string>,
  porEmisor: Map<string, string>,
): Factura {
  // En recibidas el emisor es el proveedor; en emitidas, el cliente que recibe la factura.
  const contraparte = factura.relacion === "recibida" ? factura.emisorRfc : factura.receptorRfc;
  const deEmisor = porEmisor.get(contraparte);

  factura.conceptos = factura.conceptos.map((c): Concepto => {
    // Una factura aprobada conserva la categoría que se fijó al aprobarla.
    if (factura.estadoRevision === "clasificado") {
      return { ...c, categoria: c.categoriaGuardada ?? undefined, origen: undefined };
    }
    const { categoria, origen } = elegirCategoria({
      clave: c.claveProdServ,
      relacion: factura.relacion,
      manual: porClave.get(c.claveProdServ),
      deEmisor,
      base: REGLAS_BASE[c.claveProdServ],
    });
    return { ...c, categoria, origen };
  });

  const sinCategoria = factura.conceptos.filter((c) => !c.categoria).length;
  const nombres = new Set(factura.conceptos.flatMap((c) => (c.categoria ? [c.categoria] : [])));
  factura.categoriaPropuesta =
    nombres.size === 0
      ? "Sin clasificar"
      : sinCategoria > 0
        ? `Faltan ${sinCategoria} de ${factura.conceptos.length} conceptos`
        : nombres.size === 1
          ? [...nombres][0]
          : "Varias categorías";

  const origenes = new Set(factura.conceptos.map((c) => c.origen));
  factura.origenClasificacion = origenes.has("regla")
    ? "regla"
    : origenes.has("emisor")
      ? "emisor"
      : origenes.has("base")
        ? "base"
        : origenes.has("division")
          ? "division"
          : undefined;
  return factura;
}

export type ReglaEmisor = { rfc: string; categoriaId: string; categoria: string };

// Reglas por emisor del despacho, para la pantalla de reglas.
export async function getReglasEmisor(): Promise<ReglaEmisor[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("regla_emisor")
    .select("rfc, categoria_id, categoria(nombre)")
    .order("rfc");
  if (error) throw new Error(`No se pudieron leer las reglas por emisor: ${error.message}`);
  return data.map((r) => ({
    rfc: r.rfc,
    categoriaId: r.categoria_id,
    categoria: (r.categoria as unknown as { nombre: string }).nombre,
  }));
}

export async function getFacturaPorId(id: string): Promise<Factura | undefined> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("factura")
    .select(SELECCION_FACTURA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la factura: ${error.message}`);
  if (!data) return undefined;
  const [porClave, porEmisor] = await Promise.all([mapaClaveCategoria(), mapaReglasEmisor()]);
  return conCategoria(aFactura(data as unknown as FilaFacturaCompleta), porClave, porEmisor);
}

export type Categoria = { id: string; nombre: string; deducibleDefault: boolean };

// Categorías del despacho (no las de un cliente en particular).
// Categorías del despacho; con clienteId, también las propias de ese cliente.
export async function getCategorias(clienteId?: string): Promise<Categoria[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("categoria")
    .select("id, nombre, deducible_default")
    .or(clienteId ? `cliente_id.is.null,cliente_id.eq.${clienteId}` : "cliente_id.is.null")
    .order("nombre");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return data.map((c) => ({ id: c.id, nombre: c.nombre, deducibleDefault: c.deducible_default }));
}

// porDefecto: la categoría viene de una sugerencia automática (regla base o división) y el contador aún no la eligió.
export type ClaveEnUso = {
  clave: string;
  descripcion: string;
  categoriaId: string | null;
  porDefecto: boolean;
  emitidas: number; // conceptos con esta clave en facturas emitidas (ingresos)
  recibidas: number; // conceptos con esta clave en facturas recibidas (gastos)
  aviso?: string; // la categoría asignada a mano no aplica a una parte de las facturas
};

// Solo las claves que aparecen en facturas del despacho, no las 52 mil del catálogo.
export async function getClavesEnUso(): Promise<ClaveEnUso[]> {
  const supabase = await supabaseServidor();
  const { data: usadas, error } = await supabase.from("claves_en_uso").select("clave").order("clave");
  if (error) throw new Error(`No se pudieron leer las claves: ${error.message}`);
  const claves = usadas.map((u) => u.clave as string);
  if (claves.length === 0) return [];

  const [catalogo, mapeo, usos, categorias] = await Promise.all([
    supabase.from("cat_clave_prod_serv").select("clave, descripcion").in("clave", claves),
    supabase.from("clave_categoria").select("clave, categoria_id").in("clave", claves),
    supabase.from("concepto").select("clave_prod_serv, factura!inner(relacion)").in("clave_prod_serv", claves),
    getCategorias(),
  ]);
  if (catalogo.error || mapeo.error || usos.error) throw new Error("No se pudo leer el mapeo de claves");

  const descripciones = new Map(catalogo.data.map((c) => [c.clave, c.descripcion]));
  const asignadas = new Map(mapeo.data.map((m) => [m.clave, m.categoria_id]));
  const idPorNombre = new Map(categorias.map((c) => [c.nombre, c.id]));
  const nombrePorId = new Map(categorias.map((c) => [c.id, c.nombre]));
  // Cuántos conceptos de cada clave están en facturas emitidas y en recibidas.
  const conteo = new Map<string, { emitidas: number; recibidas: number }>();
  for (const u of usos.data as unknown as { clave_prod_serv: string; factura: { relacion: string } }[]) {
    const c = conteo.get(u.clave_prod_serv) ?? { emitidas: 0, recibidas: 0 };
    if (u.factura.relacion === "emitida") c.emitidas++;
    else c.recibidas++;
    conteo.set(u.clave_prod_serv, c);
  }

  return claves.map((clave) => {
    const { emitidas, recibidas } = conteo.get(clave) ?? { emitidas: 0, recibidas: 0 };
    const asignada = asignadas.get(clave) ?? null;
    // Si la clave solo aparece en emitidas, la sugerencia es de ingreso; si no, la de gasto de siempre.
    const sugerida =
      emitidas > 0 && recibidas === 0
        ? categoriaDeIngresoDeClave(clave)
        : (REGLAS_BASE[clave] ?? categoriaSugeridaDeClave(clave));
    const sugeridaId = sugerida ? (idPorNombre.get(sugerida) ?? null) : null;

    // La categoría asignada a mano solo aplica a las facturas de su lado (ingreso o gasto).
    let aviso: string | undefined;
    const nombreAsignada = asignada ? nombrePorId.get(asignada) : undefined;
    if (nombreAsignada) {
      const deIngreso = esCategoriaDeIngreso(nombreAsignada);
      if (!deIngreso && emitidas > 0) {
        aviso = `Es una categoría de gasto: no se aplica a los ${emitidas} conceptos de facturas emitidas con esta clave, que se proponen como «${categoriaDeIngresoDeClave(clave)}».`;
      } else if (deIngreso && recibidas > 0) {
        aviso = `Es una categoría de ingreso: no se aplica a los ${recibidas} conceptos de facturas recibidas con esta clave.`;
      }
    }

    return {
      clave,
      descripcion: descripciones.get(clave) ?? "Clave no encontrada en el catálogo",
      categoriaId: asignada ?? sugeridaId,
      porDefecto: asignada === null && sugeridaId !== null,
      emitidas,
      recibidas,
      aviso,
    };
  });
}

// Enlace vigente del cliente (RF-04). Solo llamar para administrador y contador: la contraseña no se guarda
// en claro, así que aquí solo se devuelve el token y la fecha de vencimiento.
export async function getEnlaceEnvio(clienteId: string): Promise<{ token: string; venceEn: string } | null> {
  const { data } = await supabaseAdmin()
    .from("enlace_acceso").select("token, vence_en").eq("cliente_id", clienteId).maybeSingle();
  return data ? { token: data.token, venceEn: data.vence_en } : null;
}

// Facturas de la bandeja de entrada cuyo RFC no coincide con ningún cliente (RF-01).
export async function getArchivosSinCliente(): Promise<{ id: string; nombre: string; motivo: string; recibido: string }[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("archivo")
    .select("id, ruta_original, motivo_error, recibido_en")
    .is("cliente_id", null)
    .order("recibido_en", { ascending: false });
  if (error) throw new Error(`No se pudo leer la bandeja de entrada: ${error.message}`);
  return data.map((a) => ({
    id: a.id,
    nombre: a.ruta_original.split("/").pop() ?? a.ruta_original,
    motivo: a.motivo_error ?? "",
    recibido: a.recibido_en,
  }));
}

// Cambios de estado de un archivo, del más antiguo al más reciente (RF-06).
export async function getHistorialArchivo(archivoId: string) {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("archivo_historial").select("estado, motivo, ocurrido_en")
    .eq("archivo_id", archivoId).order("ocurrido_en");
  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);
  return data ?? [];
}

// CFDI que esta factura relaciona (notas de crédito, sustituciones) y si ya están en el repositorio (S2-07).
export async function getRelacionesArchivo(archivoId: string) {
  const supabase = await supabaseServidor();
  const { data: factura } = await supabase.from("factura").select("id").eq("archivo_id", archivoId).maybeSingle();
  if (!factura) return [];
  const { data, error } = await supabase
    .from("factura_relacion").select("tipo_relacion, uuid_relacionado, factura_relacionada_id")
    .eq("factura_id", factura.id);
  if (error) throw new Error(`No se pudieron leer los CFDI relacionados: ${error.message}`);
  return data ?? [];
}

// Cambios de categoría de los conceptos de una factura, del más reciente al más antiguo (RF-32).
export async function getHistorialClasificacion(conceptoIds: string[]) {
  if (conceptoIds.length === 0) return [];
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("clasificacion_historial").select("categoria_anterior, categoria_nueva, cambiado_en")
    .in("concepto_id", conceptoIds).order("cambiado_en", { ascending: false });
  if (error) throw new Error(`No se pudo leer el historial de categorías: ${error.message}`);
  return data ?? [];
}

// Categorías propias de un cliente (RF-29). Las del despacho se leen con getCategorias.
export async function getCategoriasDeCliente(clienteId: string): Promise<Categoria[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("categoria").select("id, nombre, deducible_default")
    .eq("cliente_id", clienteId).order("nombre");
  if (error) throw new Error(`No se pudieron leer las categorías del cliente: ${error.message}`);
  return data.map((c) => ({ id: c.id, nombre: c.nombre, deducibleDefault: c.deducible_default }));
}

// Factura que se leyó de un archivo (XML o PDF), o undefined si el archivo no tiene factura.
export async function getFacturaDeArchivo(archivoId: string): Promise<Factura | undefined> {
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("factura").select("id").eq("archivo_id", archivoId).maybeSingle();
  return data ? getFacturaPorId(data.id) : undefined;
}

// Totales por categoría de un cliente, solo de facturas aprobadas (RF-39, versión preliminar).
// Ingreso = factura emitida por el cliente; gasto = factura recibida por el cliente.
export type FilaCategoria = { tipo: "Ingreso" | "Gasto"; categoria: string; facturas: number; subtotal: number; ivaTrasladado: number };

export async function getResumenCategoriasCliente(clienteId: string): Promise<FilaCategoria[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("factura")
    .select("id, relacion, concepto(importe, categoria(nombre), impuesto(tipo, impuesto, importe))")
    .eq("cliente_id", clienteId)
    .eq("estado_revision", "clasificado");
  if (error) throw new Error(`No se pudo calcular el resumen: ${error.message}`);

  const mapa = new Map<string, FilaCategoria & { ids: Set<string> }>();
  for (const f of (data ?? []) as unknown as {
    id: string;
    relacion: string;
    concepto: { importe: string; categoria: { nombre: string } | null; impuesto: { tipo: string; impuesto: string; importe: string }[] }[];
  }[]) {
    const tipo: "Ingreso" | "Gasto" = f.relacion === "emitida" ? "Ingreso" : "Gasto";
    for (const c of f.concepto) {
      const categoria = c.categoria?.nombre ?? "Sin categoría";
      const clave = `${tipo}|${categoria}`;
      const fila = mapa.get(clave) ?? { tipo, categoria, facturas: 0, subtotal: 0, ivaTrasladado: 0, ids: new Set<string>() };
      fila.ids.add(f.id);
      fila.subtotal += Number(c.importe);
      fila.ivaTrasladado += c.impuesto
        .filter((i) => i.tipo === "trasladado" && i.impuesto === "IVA")
        .reduce((s, i) => s + Number(i.importe), 0);
      mapa.set(clave, fila);
    }
  }
  return [...mapa.values()]
    .map(({ ids, ...fila }) => ({ ...fila, facturas: ids.size }))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.subtotal - a.subtotal);
}
