"use server";

import { revalidatePath } from "next/cache";
import {
  buscarAcceso, DIAS_VIGENCIA, generarContrasena, generarToken, hashContrasena, sesionValida, venció,
} from "@/lib/enlace";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADO_SAT } from "@/lib/catalogos-cfdi";
import { leerCfdi } from "@/lib/cfdi";
import { clasificar, MAX_BYTES, nombreSeguro } from "@/lib/archivos";
import { consultarEstadoSat } from "@/lib/sat";
import { dinero } from "@/lib/formato";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServidor } from "@/lib/supabase-servidor";

type Lectura = { ok: boolean; texto: string };

// Lee un XML ya subido: valida el CFDI y guarda la factura con sus conceptos e impuestos.
export async function procesarXml(archivoId: string): Promise<Lectura> {
  return leerXml(await supabaseServidor(), archivoId);
}

// Con la sesión del contador, o con la clave de servicio en el envío por enlace (ya validado el token).
async function leerXml(supabase: SupabaseClient, archivoId: string): Promise<Lectura> {
  // Pasa de "recibido" a "leyendo"; si otro proceso ya lo tomó, no se procesa dos veces.
  const { data: archivo } = await supabase
    .from("archivo")
    .update({ estado: "leyendo" })
    .eq("id", archivoId).eq("estado", "recibido").eq("tipo", "xml")
    .select("id, cliente_id, ruta_original")
    .maybeSingle();
  if (!archivo) return { ok: false, texto: "El archivo no está disponible para leerse" };

  const fallar = async (motivo: string) => {
    await supabase.from("archivo").update({ estado: "error", motivo_error: motivo }).eq("id", archivoId);
    revalidatePath(`/clientes/${archivo.cliente_id}`);
    return { ok: false, texto: motivo };
  };

  const { data: descarga } = await supabase.storage.from("facturas").download(archivo.ruta_original);
  if (!descarga) return fallar("No se pudo abrir el archivo para leerlo");
  const leido = leerCfdi(await descarga.text());
  if ("error" in leido) return fallar(leido.error);
  const { factura } = leido;

  // RN-03: la factura debe ser del cliente, ya sea emitida o recibida por él.
  const { data: cliente } = await supabase.from("clientes").select("rfc").eq("id", archivo.cliente_id).maybeSingle();
  const rfc = cliente?.rfc.toUpperCase();
  const relacion =
    factura.rfc_emisor.toUpperCase() === rfc ? "emitida"
    : factura.rfc_receptor.toUpperCase() === rfc ? "recibida"
    : null;
  if (!relacion) {
    return fallar(`El RFC del cliente (${cliente?.rfc}) no es el emisor (${factura.rfc_emisor}) ni el receptor (${factura.rfc_receptor}) de la factura`);
  }

  // RN-01: una factura cancelada ante el SAT no entra a los resúmenes. Si el SAT no responde, queda sin consultar.
  const sat = await consultarEstadoSat({
    uuid: factura.uuid_fiscal, rfcEmisor: factura.rfc_emisor, rfcReceptor: factura.rfc_receptor,
    total: factura.total, sello: factura.sello,
  });
  const exclusion = leido.exclusion ?? (sat === "cancelada" ? "Cancelada ante el SAT" : null);

  // El permiso ya se comprobó con la sesión del usuario al reservar el archivo (RLS).
  // La factura la guarda el servidor con la clave de servicio: nadie puede guardarla desde el navegador.
  const { error } = await supabaseAdmin().rpc("guardar_factura", {
    p_archivo: archivoId,
    p_factura: {
      ...factura,
      sello: undefined, // solo sirve para la consulta; no se guarda
      relacion,
      motivo_exclusion: exclusion,
      estado_sat: sat,
      fecha_consulta_sat: sat ? new Date().toISOString() : null,
    },
    p_conceptos: leido.conceptos,
  });
  if (error) {
    return fallar(
      error.code === "23505"
        ? "Esta factura ya está en el repositorio de este cliente (mismo UUID fiscal)"
        : "No se pudo guardar la factura",
    );
  }

  revalidatePath(`/clientes/${archivo.cliente_id}`);
  if (exclusion) return { ok: false, texto: `Leída, pero excluida: ${exclusion}` };
  const estadoSat = sat ? ESTADO_SAT[sat].texto : "sin consultar";
  return { ok: true, texto: `Leído y guardado: ${factura.rfc_emisor} → ${factura.rfc_receptor} · ${dinero(factura.total, factura.moneda)} · SAT: ${estadoSat}` };
}

// Vuelve a preguntar al SAT por una factura ya leída (por ejemplo, si no respondió o si pudo cancelarse después).
export async function reconsultarSat(archivoId: string): Promise<{ ok: boolean; texto: string }> {
  const supabase = await supabaseServidor();
  const { data: factura } = await supabase
    .from("factura")
    .select("id, cliente_id, uuid_fiscal, rfc_emisor, rfc_receptor, total, motivo_exclusion, archivo(ruta_original)")
    .eq("archivo_id", archivoId)
    .maybeSingle();
  if (!factura) return { ok: false, texto: "Este archivo no tiene una factura leída" };

  // El sello está en el XML original, no en la base.
  const ruta = (factura.archivo as unknown as { ruta_original: string }).ruta_original;
  const { data: descarga } = await supabase.storage.from("facturas").download(ruta);
  const leido = descarga ? leerCfdi(await descarga.text()) : null;
  const sello = leido && !("error" in leido) ? leido.factura.sello : null;

  const sat = await consultarEstadoSat({
    uuid: factura.uuid_fiscal, rfcEmisor: factura.rfc_emisor, rfcReceptor: factura.rfc_receptor,
    total: String(factura.total), sello,
  });
  if (!sat) return { ok: false, texto: "El SAT no respondió. Inténtalo de nuevo en un momento." };

  const cambios: Record<string, string> = { estado_sat: sat, fecha_consulta_sat: new Date().toISOString() };
  if (sat === "cancelada") {
    cambios.estado_revision = "excluido";
    cambios.motivo_exclusion = factura.motivo_exclusion ?? "Cancelada ante el SAT";
  }
  // RLS: solo el contador y el administrador pueden actualizar facturas.
  const { data: actualizada } = await supabase.from("factura").update(cambios).eq("id", factura.id).select("id");
  if (!actualizada?.length) return { ok: false, texto: "No tienes permiso para actualizar la factura" };
  if (sat === "cancelada") {
    // El paso por_revisar → error no se permite desde la sesión del usuario (script de endurecimiento):
    // el permiso ya se comprobó al actualizar la factura con RLS, así que el archivo lo marca el servidor.
    await supabaseAdmin().from("archivo").update({ estado: "error", motivo_error: cambios.motivo_exclusion }).eq("id", archivoId);
  }

  revalidatePath(`/clientes/${factura.cliente_id}`);
  return { ok: true, texto: `Estado ante el SAT: ${ESTADO_SAT[sat].texto}` };
}

// Vuelve a leer un XML que quedó con error, sin leer o atorado en "leyendo" más de 5 minutos.
// No aplica si ya tiene factura (por ejemplo, una factura excluida porque sus importes no cuadran).
export async function reintentarLectura(archivoId: string): Promise<Lectura> {
  const supabase = await supabaseServidor();
  // Con la sesión del usuario: RLS confirma que el archivo es de su despacho.
  const { data: archivo } = await supabase
    .from("archivo")
    .select("id, tipo, estado, recibido_en, factura(id)")
    .eq("id", archivoId)
    .maybeSingle();
  if (!archivo || archivo.tipo !== "xml") return { ok: false, texto: "El archivo no está disponible para leerse" };

  // La relación llega como objeto o null (factura.archivo_id es único); se acepta también una lista.
  const relacion = archivo.factura as { id: string } | { id: string }[] | null;
  const tieneFactura = Array.isArray(relacion) ? relacion.length > 0 : Boolean(relacion);
  const atorado = archivo.estado === "leyendo" && Date.now() - new Date(archivo.recibido_en).getTime() > 5 * 60_000;
  if (tieneFactura || !(archivo.estado === "error" || archivo.estado === "recibido" || atorado)) {
    return { ok: false, texto: "Este archivo no se puede volver a leer" };
  }

  if (archivo.estado !== "recibido") {
    // Volver a "recibido" no es un paso permitido desde la sesión del usuario (script 08): lo hace el servidor.
    const { data, error } = await supabaseAdmin()
      .from("archivo")
      .update({ estado: "recibido", motivo_error: null })
      .eq("id", archivoId).eq("estado", archivo.estado)
      .select("id");
    if (error) {
      return {
        ok: false,
        texto: error.code === "23505" ? "Ya hay otra copia de este archivo en el repositorio" : "No se pudo reintentar la lectura",
      };
    }
    if (!data?.length) return { ok: false, texto: "El archivo cambió mientras tanto; recarga la página" };
  }
  return procesarXml(archivoId);
}

// Genera (o reemplaza) el enlace y la contraseña del cliente. Lo anterior deja de funcionar.
// La contraseña se devuelve una sola vez: en la base solo queda su hash.
export async function generarEnlaceEnvio(clienteId: string): Promise<{
  token?: string;
  contrasena?: string;
  venceEn?: string;
  error?: string;
}> {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." };
  const { data: yo } = await supabase.from("usuario").select("rol").eq("id", user.id).maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden generar enlaces." };
  }
  // RLS: solo si el cliente es de su despacho.
  const { data: cliente } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();
  if (!cliente) return { error: "No se encontró el cliente." };

  const token = generarToken();
  const contrasena = generarContrasena();
  const venceEn = new Date(Date.now() + DIAS_VIGENCIA * 86_400_000).toISOString();
  const { error } = await supabaseAdmin().from("enlace_acceso").upsert(
    {
      cliente_id: clienteId,
      token,
      password_hash: hashContrasena(contrasena),
      vence_en: venceEn,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    },
    { onConflict: "cliente_id" },
  );
  if (error) return { error: "No se pudo generar el enlace." };

  revalidatePath(`/clientes/${clienteId}`);
  return { token, contrasena, venceEn };
}

export type ResultadoEnvio = { nombre: string; texto: string; bien: boolean };

// Envío por enlace (RF-04): el cliente sube XML sin cuenta. Solo el token identifica al cliente.
// Acepta solo XML: los PDF y escaneos siguen por la carga del contador (RF-13 a RF-18).
export async function subirXmlPorEnlace(
  token: string,
  formData: FormData,
): Promise<{ resultados: ResultadoEnvio[]; error?: string }> {
  if (!/^[a-f0-9]{48}$/.test(token)) return { resultados: [], error: "Este enlace no es válido." };
  const acceso = await buscarAcceso(token);
  if (!acceso) return { resultados: [], error: "Este enlace no es válido o ya fue reemplazado." };
  if (venció(acceso)) return { resultados: [], error: "Este enlace venció. Pide uno nuevo a tu contador." };
  // La contraseña se comprobó al abrir la página; la sesión firmada demuestra que se hizo.
  if (!(await sesionValida(token))) return { resultados: [], error: "Escribe la contraseña para continuar." };
  const admin = supabaseAdmin();
  const cliente = { id: acceso.cliente_id };

  const archivos = formData.getAll("archivos").filter((x): x is File => x instanceof File).slice(0, 20);
  if (archivos.length === 0) return { resultados: [], error: "Elige al menos un archivo XML." };

  const resultados: ResultadoEnvio[] = [];
  for (const f of archivos) {
    const nombre = f.name;
    if (f.size > MAX_BYTES) {
      resultados.push({ nombre, texto: "Pasa de 20 MB", bien: false });
      continue;
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const clase = clasificar(nombre, bytes);
    if ("error" in clase || clase.tipo !== "xml") {
      resultados.push({ nombre, texto: "Solo se aceptan XML de factura", bien: false });
      continue;
    }

    // Mismo contenido ya guardado para este cliente: no se vuelve a sumar (RF-05).
    const huella = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const { data: repetido } = await admin
      .from("archivo").select("id")
      .eq("cliente_id", cliente.id).eq("huella_sha256", huella).neq("estado", "error")
      .maybeSingle();
    if (repetido) {
      resultados.push({ nombre, texto: "Ya la tenemos: esta factura ya está en el repositorio", bien: false });
      continue;
    }

    const id = crypto.randomUUID();
    const ruta = `${cliente.id}/${id}/${nombreSeguro(nombre)}`;
    const { error: errorFila } = await admin.from("archivo").insert({
      id, cliente_id: cliente.id, tipo: "xml", huella_sha256: huella, ruta_original: ruta, origen: "enlace",
    });
    if (errorFila) {
      resultados.push({ nombre, texto: "No se pudo registrar el archivo", bien: false });
      continue;
    }
    const { error: errorSubida } = await admin.storage.from("facturas").upload(
      ruta, new Blob([bytes as BlobPart], { type: clase.mime }), { contentType: clase.mime },
    );
    if (errorSubida) {
      await admin.from("archivo").update({ estado: "error", motivo_error: "No se pudo subir el archivo" }).eq("id", id);
      resultados.push({ nombre, texto: "No se pudo subir; vuelve a intentarlo", bien: false });
      continue;
    }

    const lectura = await leerXml(admin, id);
    resultados.push({ nombre, texto: lectura.texto, bien: lectura.ok });
  }
  return { resultados };
}

// Enlace que vence en 60 segundos para abrir un archivo privado.
// Storage aplica los permisos de la persona en sesión, así que no abre archivos de otros despachos.
export async function urlArchivo(ruta: string): Promise<{ url?: string; error?: string }> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.storage.from("facturas").createSignedUrl(ruta, 60);
  if (error || !data) return { error: "No se pudo abrir el archivo." };
  return { url: data.signedUrl };
}
