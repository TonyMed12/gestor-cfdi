import type { Cliente } from "./types";
import { supabaseServidor } from "./supabase-servidor";

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
    .select("id, razon_social, rfc")
    .eq("id", id)
    .maybeSingle();
  return data ? aCliente(data) : undefined;
}
