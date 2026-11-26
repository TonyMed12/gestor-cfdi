"use server";

import { revalidatePath } from "next/cache";
import {
  buscarAcceso, DIAS_VIGENCIA, generarContrasena, generarToken, hashContrasena, MENSAJE_CLIENTE_INACTIVO, sesionValida, venció,
} from "@/lib/enlace";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADO_SAT } from "@/lib/catalogos-cfdi";
import { leerCfdi, type CfdiLeido } from "@/lib/cfdi";
import { leerTextoPdf, selloEn } from "@/lib/pdf";
import { clasificar, MAX_BYTES, nombreSeguro, type Clasificado } from "@/lib/archivos";
import { consultarEstadoSat } from "@/lib/sat";
import { dinero } from "@/lib/formato";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServidor } from "@/lib/supabase-servidor";
import { registrarAccion } from "@/lib/bitacora";
import { rfcsEn } from "@/lib/texto-fiscal";

type Lectura = { ok: boolean; texto: string };

// Lee un XML ya subido: valida el CFDI y guarda la factura con sus conceptos e impuestos.
export async function procesarXml(archivoId: string): Promise<Lectura> {
  return leerXml(await supabaseServidor(), archivoId);
}

// Con la sesión del contador, o con la clave de servicio en el envío por enlace (ya validado el token).
// Historial del archivo (RF-06): cada cambio de estado queda con su hora y su motivo.
async function registrarHistorial(archivoId: string, estado: string, motivo?: string) {
  await supabaseAdmin().from("archivo_historial").insert({ archivo_id: archivoId, estado, motivo: motivo ?? null });
}

// Si la factura del cliente con ese UUID se leyó desde PDF, la quita para que entre el XML. Devuelve true si la quitó.
async function reemplazarSiEsPdf(clienteId: string, uuid: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data: previa } = await admin
    .from("factura").select("id, archivo_id")
    .eq("cliente_id", clienteId).eq("uuid_fiscal", uuid).eq("fuente", "pdf").maybeSingle();
  if (!previa) return false;
  await admin.from("factura").delete().eq("id", previa.id);
  await admin.from("archivo").update({ estado: "error", motivo_error: "Reemplazado por el XML de la misma factura" })
    .eq("id", previa.archivo_id);
  await registrarHistorial(previa.archivo_id, "error", "Reemplazado por el XML de la misma factura");
  return true;
}

// Guarda una factura leída de la representación impresa en PDF (RF-13). Queda marcada como lectura de PDF.
async function guardarFacturaDePdf(
  archivoId: string,
  clienteId: string,
  clienteRfc: string,
  leido: CfdiLeido,
): Promise<{ texto: string; bien: boolean }> {
  const admin = supabaseAdmin();
  const f = leido.factura;
  const relacion = f.rfc_emisor.toUpperCase() === clienteRfc.toUpperCase() ? "emitida" : "recibida";
  await admin.from("archivo").update({ estado: "leyendo" }).eq("id", archivoId);

  // Mismo criterio que el XML: consulta al SAT con los datos del PDF y el sello impreso.
  const sat = await consultarEstadoSat({
    uuid: f.uuid_fiscal, rfcEmisor: f.rfc_emisor, rfcReceptor: f.rfc_receptor, total: f.total, sello: f.sello,
  });
  const exclusion = leido.exclusion ?? (sat === "cancelada" ? "Cancelada ante el SAT" : null);
  const payload = {
    p_archivo: archivoId,
    p_factura: {
      ...f, sello: undefined, relacion, motivo_exclusion: exclusion,
      estado_sat: sat, fecha_consulta_sat: sat ? new Date().toISOString() : null,
    },
    p_conceptos: leido.conceptos,
  };
  let { error } = await admin.rpc("guardar_factura", payload);
  if (error?.code === "23505" && (await reemplazarSiEsPdf(clienteId, f.uuid_fiscal))) {
    ({ error } = await admin.rpc("guardar_factura", payload));
  }
  if (error) {
    const motivo = error.code === "23505"
      ? "Ya está en el repositorio como XML de esta factura"
      : "No se pudo guardar la factura leída del PDF";
    await admin.from("archivo").update({ estado: "error", motivo_error: motivo }).eq("id", archivoId);
    await registrarHistorial(archivoId, "error", motivo);
    return { texto: motivo, bien: false };
  }
  await registrarHistorial(archivoId, exclusion ? "error" : "por_revisar", exclusion ?? "Leída de PDF");
  const estadoSat = sat ? ESTADO_SAT[sat].texto : "sin consultar";
  return exclusion
    ? { texto: `Leída de PDF, pero excluida: ${exclusion}`, bien: false }
    : { texto: `Leída del PDF · SAT: ${estadoSat} · confirma los datos cuando llegue el XML`, bien: true };
}

async function leerXml(supabase: SupabaseClient, archivoId: string): Promise<Lectura> {
  // Pasa de "recibido" a "leyendo"; si otro proceso ya lo tomó, no se procesa dos veces.
  const { data: archivo } = await supabase
    .from("archivo")
    .update({ estado: "leyendo" })
    .eq("id", archivoId).eq("estado", "recibido").eq("tipo", "xml")
    .select("id, cliente_id, ruta_original")
    .maybeSingle();
  if (!archivo) return { ok: false, texto: "El archivo no está disponible para leerse" };
  await registrarHistorial(archivoId, "leyendo");

  const fallar = async (motivo: string) => {
    await supabase.from("archivo").update({ estado: "error", motivo_error: motivo }).eq("id", archivoId);
    await registrarHistorial(archivoId, "error", motivo);
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
  const payload = {
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
  };
  let { error } = await supabaseAdmin().rpc("guardar_factura", payload);
  // RN-04: el XML reemplaza a una lectura previa hecha desde PDF de la misma factura.
  if (error?.code === "23505" && (await reemplazarSiEsPdf(archivo.cliente_id, factura.uuid_fiscal))) {
    ({ error } = await supabaseAdmin().rpc("guardar_factura", payload));
  }
  if (error) {
    return fallar(
      error.code === "23505"
        ? "Esta factura ya está en el repositorio de este cliente (mismo UUID fiscal)"
        : "No se pudo guardar la factura",
    );
  }

  // Datos que la función de guardado no recibe: régimen del receptor y CFDI relacionados (S2-07).
  const admin = supabaseAdmin();
  const { data: creada } = await admin.from("factura").select("id").eq("archivo_id", archivoId).maybeSingle();
  if (creada) {
    await admin.from("factura").update({ regimen_receptor: factura.regimen_receptor }).eq("id", creada.id);
    if (factura.relacionados.length > 0) {
      await admin.from("factura_relacion").upsert(
        factura.relacionados.map((r) => ({ factura_id: creada.id, tipo_relacion: r.tipo_relacion, uuid_relacionado: r.uuid })),
        { onConflict: "factura_id,tipo_relacion,uuid_relacionado" },
      );
      // Enlaza con las facturas del mismo cliente que ya existen, en ambos sentidos.
      const uuids = factura.relacionados.map((r) => r.uuid);
      const { data: existentes } = await admin
        .from("factura").select("id, uuid_fiscal").eq("cliente_id", archivo.cliente_id).in("uuid_fiscal", uuids);
      for (const e of existentes ?? []) {
        await admin.from("factura_relacion").update({ factura_relacionada_id: e.id })
          .eq("factura_id", creada.id).eq("uuid_relacionado", e.uuid_fiscal);
      }
    }
    const { data: propias } = await admin.from("factura").select("id").eq("cliente_id", archivo.cliente_id);
    await admin.from("factura_relacion").update({ factura_relacionada_id: creada.id })
      .eq("uuid_relacionado", factura.uuid_fiscal).in("factura_id", (propias ?? []).map((p) => p.id));
  }
  await registrarHistorial(archivoId, exclusion ? "error" : "por_revisar", exclusion ?? undefined);

  revalidatePath(`/clientes/${archivo.cliente_id}`);
  if (exclusion) return { ok: false, texto: `Leída, pero excluida: ${exclusion}` };
  const estadoSat = sat ? ESTADO_SAT[sat].texto : "sin consultar";
  return { ok: true, texto: `Leído y guardado: ${factura.rfc_emisor} → ${factura.rfc_receptor} · ${dinero(factura.total, factura.moneda)} · SAT: ${estadoSat}` };
}

// Vuelve a preguntar al SAT por una factura ya leída (por ejemplo, si no respondió o si pudo cancelarse después).
export async function reconsultarSat(archivoId: string): Promise<{ ok: boolean; texto: string }> {
  // G7: guardar el estado ante el SAT cambia la factura: solo administrador y contador (RLS también lo impide).
  const r = await rolDecisor();
  if ("error" in r) return { ok: false, texto: r.error ?? "No tienes permiso para esto." };
  const { ok, texto } = await consultarDeNuevo(archivoId);
  return { ok, texto };
}

type Reconsulta = {
  ok: boolean;
  texto: string;
  estado?: "vigente" | "cancelada" | "no_encontrada";
  sinRespuesta?: boolean; // el SAT no respondió (distinto de no tener permiso)
  nuevaCancelada?: boolean; // antes no estaba cancelada y ahora sí
};

// Consulta al SAT una factura y guarda su estado. Si el SAT la reporta cancelada, sale del resumen
// (estado excluido, motivo "Cancelada ante el SAT", RN-01). La usan reconsultarSat y reconsultarPeriodo.
async function consultarDeNuevo(archivoId: string): Promise<Reconsulta> {
  const supabase = await supabaseServidor();
  const { data: factura } = await supabase
    .from("factura")
    .select("id, cliente_id, uuid_fiscal, rfc_emisor, rfc_receptor, total, estado_sat, motivo_exclusion, archivo(ruta_original, tipo)")
    .eq("archivo_id", archivoId)
    .maybeSingle();
  if (!factura) return { ok: false, texto: "Este archivo no tiene una factura leída" };

  // El sello está en el XML original, no en la base.
  const { ruta_original: ruta, tipo } = factura.archivo as unknown as { ruta_original: string; tipo: string };
  const { data: descarga } = await supabase.storage.from("facturas").download(ruta);
  let sello: string | null = null;
  if (descarga && tipo === "pdf") {
    sello = selloEn(await leerTextoPdf(new Uint8Array(await descarga.arrayBuffer())));
  } else if (descarga) {
    const leido = leerCfdi(await descarga.text());
    sello = "error" in leido ? null : leido.factura.sello;
  }

  const sat = await consultarEstadoSat({
    uuid: factura.uuid_fiscal, rfcEmisor: factura.rfc_emisor, rfcReceptor: factura.rfc_receptor,
    total: String(factura.total), sello,
  });
  if (!sat) return { ok: false, sinRespuesta: true, texto: "El SAT no respondió. Inténtalo de nuevo en un momento." };

  const cambios: Record<string, string> = { estado_sat: sat, fecha_consulta_sat: new Date().toISOString() };
  if (sat === "cancelada") {
    cambios.estado_revision = "excluido";
    cambios.motivo_exclusion = factura.motivo_exclusion ?? "Cancelada ante el SAT";
  }
  // RLS: solo el contador y el administrador pueden actualizar facturas.
  const { data: actualizada, error: errorActualizar } = await supabase
    .from("factura").update(cambios).eq("id", factura.id).select("id");
  // D4: una factura aprobada de un periodo cerrado no cambia de estado sin motivo (supabase/22-cierre-de-periodo.sql).
  if (errorActualizar?.code === "PC001") {
    return {
      ok: false,
      texto: `El SAT la reporta ${ESTADO_SAT[sat].texto.toLowerCase()}, pero su periodo está cerrado: no se cambió.`,
    };
  }
  if (!actualizada?.length) return { ok: false, texto: "No tienes permiso para actualizar la factura" };
  if (sat === "cancelada") {
    // El paso por_revisar → error no se permite desde la sesión del usuario (script de endurecimiento):
    // el permiso ya se comprobó al actualizar la factura con RLS, así que el archivo lo marca el servidor.
    await supabaseAdmin().from("archivo").update({ estado: "error", motivo_error: cambios.motivo_exclusion }).eq("id", archivoId);
  }

  revalidatePath(`/clientes/${factura.cliente_id}`);
  return {
    ok: true,
    texto: `Estado ante el SAT: ${ESTADO_SAT[sat].texto}`,
    estado: sat,
    nuevaCancelada: sat === "cancelada" && factura.estado_sat !== "cancelada",
  };
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
  if (error) {
    console.error("generarEnlaceEnvio:", error.message);
    return { error: "No se pudo generar el enlace. Intenta de nuevo." };
  }

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
  // H2: un cliente desactivado no recibe facturas nuevas, tampoco por su enlace (como en la bandeja de entrada).
  if (!acceso.cliente_activo) return { resultados: [], error: MENSAJE_CLIENTE_INACTIVO };
  // La contraseña se comprobó al abrir la página; la sesión firmada demuestra que se hizo.
  if (!(await sesionValida(token))) return { resultados: [], error: "Escribe la contraseña para continuar." };
  const admin = supabaseAdmin();
  const cliente = { id: acceso.cliente_id };

  const archivos = formData.getAll("archivos").filter((x): x is File => x instanceof File).slice(0, 20);
  if (archivos.length === 0) return { resultados: [], error: "Elige al menos un archivo XML." };

  const resultados: ResultadoEnvio[] = [];
  for (const f of archivos) {
    if (f.size > MAX_BYTES) {
      resultados.push({ nombre: f.name, texto: "Pasa de 20 MB", bien: false });
      continue;
    }
    const r = await guardarXmlDeCliente(admin, cliente.id, f.name, new Uint8Array(await f.arrayBuffer()), "enlace");
    resultados.push({ nombre: f.name, ...r });
  }
  return { resultados };
}

async function huellaHex(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// Guarda un archivo en el repositorio de un cliente. Devuelve el id si quedó guardado.
async function guardarEnRepositorio(
  admin: SupabaseClient,
  clienteId: string,
  nombre: string,
  bytes: Uint8Array,
  clase: Clasificado,
  origen: "enlace" | "entrada",
): Promise<{ id?: string; error?: string }> {
  // Mismo contenido ya guardado para este cliente: no se vuelve a sumar (RF-05).
  const huella = await huellaHex(bytes);
  const { data: repetido } = await admin
    .from("archivo").select("id")
    .eq("cliente_id", clienteId).eq("huella_sha256", huella).neq("estado", "error")
    .maybeSingle();
  if (repetido) return { error: "Ya está en el repositorio" };

  const id = crypto.randomUUID();
  const ruta = `${clienteId}/${id}/${nombreSeguro(nombre)}`;
  const { error: errorFila } = await admin.from("archivo").insert({
    id, cliente_id: clienteId, tipo: clase.tipo, huella_sha256: huella, ruta_original: ruta, origen,
  });
  if (errorFila) return { error: "No se pudo registrar el archivo" };

  const { error: errorSubida } = await admin.storage.from("facturas").upload(
    ruta, new Blob([bytes as BlobPart], { type: clase.mime }), { contentType: clase.mime },
  );
  if (errorSubida) {
    await admin.from("archivo").update({ estado: "error", motivo_error: "No se pudo subir el archivo" }).eq("id", id);
    return { error: "No se pudo subir; vuelve a intentarlo" };
  }
  await registrarHistorial(id, "recibido");
  return { id };
}

// XML: se guarda y se lee la factura. Lo usan el envío por enlace y la bandeja de entrada.
async function guardarXmlDeCliente(
  admin: SupabaseClient,
  clienteId: string,
  nombre: string,
  bytes: Uint8Array,
  origen: "enlace" | "entrada",
): Promise<{ texto: string; bien: boolean }> {
  const clase = clasificar(nombre, bytes);
  if ("error" in clase || clase.tipo !== "xml") return { texto: "Solo se aceptan XML de factura", bien: false };
  const r = await guardarEnRepositorio(admin, clienteId, nombre, bytes, clase, origen);
  if (!r.id) return { texto: r.error ?? "No se pudo guardar", bien: false };
  const lectura = await leerXml(admin, r.id);
  return { texto: lectura.texto, bien: lectura.ok };
}

// PDF o imagen: se guarda para revisión. No crea factura: el XML es la fuente de los datos (ADR-0001).
async function guardarDocumentoDeCliente(
  admin: SupabaseClient,
  clienteId: string,
  nombre: string,
  bytes: Uint8Array,
  clase: Clasificado,
): Promise<{ texto: string; bien: boolean }> {
  const r = await guardarEnRepositorio(admin, clienteId, nombre, bytes, clase, "entrada");
  if (!r.id) return { texto: r.error ?? "No se pudo guardar", bien: false };
  await admin.from("archivo").update({ estado: "por_revisar" }).eq("id", r.id);
  await registrarHistorial(r.id, "por_revisar");
  return { texto: "Guardado para revisión", bien: true };
}

// Bandeja "sin cliente": el archivo se guarda en el despacho hasta que se asigne.
async function guardarSinCliente(
  admin: SupabaseClient,
  despachoId: string,
  nombre: string,
  bytes: Uint8Array,
  clase: Clasificado,
  motivo: string,
): Promise<{ texto: string; bien: boolean }> {
  const huella = await huellaHex(bytes);
  const { data: repetido } = await admin
    .from("archivo").select("id")
    .eq("despacho_id", despachoId).is("cliente_id", null).eq("huella_sha256", huella)
    .maybeSingle();
  if (repetido) return { texto: "Ya está en la bandeja de entrada", bien: false };

  const id = crypto.randomUUID();
  const ruta = `entrada/${despachoId}/${id}/${nombreSeguro(nombre)}`;
  const { error: errorFila } = await admin.from("archivo").insert({
    id, despacho_id: despachoId, tipo: clase.tipo, huella_sha256: huella, ruta_original: ruta,
    origen: "entrada", estado: "error", motivo_error: motivo,
  });
  if (errorFila) return { texto: "No se pudo registrar el archivo", bien: false };

  const { error: errorSubida } = await admin.storage.from("facturas").upload(
    ruta, new Blob([bytes as BlobPart], { type: clase.mime }), { contentType: clase.mime },
  );
  if (errorSubida) {
    await admin.from("archivo").delete().eq("id", id);
    return { texto: "No se pudo guardar; vuelve a intentarlo", bien: false };
  }
  await registrarHistorial(id, "error", motivo);
  return { texto: "Sin cliente: quedó en la bandeja de entrada", bien: false };
}

async function clientesPorRfc(admin: SupabaseClient, despachoId: string, rfcs: string[]) {
  if (rfcs.length === 0) return [];
  const { data } = await admin
    .from("clientes").select("id, razon_social, rfc").eq("despacho_id", despachoId).eq("activo", true).in("rfc", rfcs);
  return data ?? [];
}

// Bandeja de entrada (RF-01): se suben XML sin elegir cliente. Cada factura va al repositorio del emisor
// y del receptor que sean clientes del despacho (si ambos lo son, se guarda en los dos).
// Si ninguno lo es, queda en la bandeja "sin cliente" para asignarla después.
export async function subirAEntrada(
  formData: FormData,
): Promise<{ resultados: ResultadoEnvio[]; error?: string }> {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { resultados: [], error: "Tu sesión venció. Inicia sesión de nuevo." };
  const { data: yo } = await supabase.from("usuario").select("despacho_id, rol").eq("id", user.id).maybeSingle();
  if (!yo || !["administrador", "contador", "auxiliar"].includes(yo.rol)) {
    return { resultados: [], error: "No tienes permiso para subir facturas." };
  }

  const archivos = formData.getAll("archivos").filter((x): x is File => x instanceof File);
  if (archivos.length === 0) return { resultados: [], error: "Elige al menos un archivo XML." };

  const admin = supabaseAdmin();
  const resultados: ResultadoEnvio[] = [];
  for (const f of archivos) {
    const nombre = f.name;
    if (f.size > MAX_BYTES) {
      resultados.push({ nombre, texto: "Pasa de 20 MB", bien: false });
      continue;
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const clase = clasificar(nombre, bytes);
    if ("error" in clase) {
      resultados.push({ nombre, texto: clase.error, bien: false });
      continue;
    }

    if (clase.tipo === "xml") {
      const leido = leerCfdi(new TextDecoder().decode(bytes));
      if ("error" in leido) {
        resultados.push({ nombre, texto: "No es una factura CFDI válida", bien: false });
        continue;
      }
      const rfcs = [...new Set([leido.factura.rfc_emisor, leido.factura.rfc_receptor].map((r) => r.toUpperCase()))];
      const clientes = await clientesPorRfc(admin, yo.despacho_id, rfcs);
      if (clientes.length === 0) {
        const r = await guardarSinCliente(admin, yo.despacho_id, nombre, bytes, clase,
          `Ningún cliente tiene el RFC ${rfcs.join(" ni ")}`);
        resultados.push({ nombre, ...r });
        continue;
      }
      for (const c of clientes) {
        const r = await guardarXmlDeCliente(admin, c.id, nombre, bytes, "entrada");
        resultados.push({ nombre: `${nombre} → ${c.razon_social}`, ...r });
      }
      continue;
    }

    // PDF o imagen: se lee el texto (o se hace OCR local) y se busca el RFC de algún cliente.
    try {
      if (clase.tipo === "pdf") {
        const pdf = await import("@/lib/pdf");
        const leidoPdf = pdf.leerFacturaPdf(await pdf.leerTextoPdf(bytes));
        if (!("error" in leidoPdf)) {
          const rfcsFactura = [leidoPdf.factura.rfc_emisor, leidoPdf.factura.rfc_receptor].map((r) => r.toUpperCase());
          const clientesFactura = await clientesPorRfc(admin, yo.despacho_id, rfcsFactura);
          if (clientesFactura.length === 0) {
            const r = await guardarSinCliente(admin, yo.despacho_id, nombre, bytes, clase,
              `Ningún cliente tiene el RFC ${rfcsFactura.join(" ni ")}`);
            resultados.push({ nombre, ...r });
            continue;
          }
          for (const c of clientesFactura) {
            const guardado = await guardarEnRepositorio(admin, c.id, nombre, bytes, clase, "entrada");
            if (!guardado.id) {
              resultados.push({ nombre: `${nombre} → ${c.razon_social}`, texto: guardado.error ?? "No se pudo guardar", bien: false });
              continue;
            }
            const r = await guardarFacturaDePdf(guardado.id, c.id, c.rfc, leidoPdf);
            resultados.push({ nombre: `${nombre} → ${c.razon_social}`, ...r });
          }
          continue;
        }
      }
      const texto = clase.tipo === "pdf"
        ? await (await import("@/lib/pdf")).leerTextoPdf(bytes)
        : await (await import("@/lib/ocr")).leerTextoImagen(bytes);
      const clientes = await clientesPorRfc(admin, yo.despacho_id, rfcsEn(texto));
      if (clientes.length === 0) {
        const r = await guardarSinCliente(admin, yo.despacho_id, nombre, bytes, clase,
          "No se encontró el RFC de ningún cliente en el documento");
        resultados.push({ nombre, ...r });
        continue;
      }
      for (const c of clientes) {
        const r = await guardarDocumentoDeCliente(admin, c.id, nombre, bytes, clase);
        resultados.push({ nombre: `${nombre} → ${c.razon_social}`, ...r });
      }
    } catch (error) {
      console.error(`Lectura de ${nombre} (${clase.tipo}):`, error);
      resultados.push({ nombre, texto: "No se pudo leer el documento", bien: false });
    }
  }

  // Bitácora (RF-47): quién subió cada archivo y qué pasó con él.
  for (const r of resultados) {
    try {
      await registrarAccion(supabase, "subio", { archivo: r.nombre, resultado: r.texto });
    } catch {
      // si no se puede registrar, la carga ya quedó hecha; no se revierte
    }
  }
  revalidatePath("/entrada");
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

// Solo administrador y contador cambian clientes y categorías.
async function rolDecisor() {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." } as const;
  const { data: yo } = await supabase.from("usuario").select("despacho_id, rol").eq("id", user.id).maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden hacer esto." } as const;
  }
  return { supabase, despachoId: yo.despacho_id as string };
}

// Edita la razón social y activa o desactiva al cliente. Un cliente inactivo deja de recibir facturas nuevas.
export async function actualizarCliente(clienteId: string, datos: FormData): Promise<{ error?: string }> {
  const r = await rolDecisor();
  if ("error" in r) return { error: r.error };
  const nombre = String(datos.get("razon_social") ?? "").trim();
  if (!nombre || nombre.length > 160) return { error: "La razón social es obligatoria (máximo 160 caracteres)." };
  const { data, error } = await r.supabase
    .from("clientes").update({ razon_social: nombre, activo: datos.get("activo") === "on" })
    .eq("id", clienteId).select("id");
  if (error || !data?.length) return { error: "No se pudo guardar el cliente." };
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return {};
}

// Categoría propia de un cliente, además de las del despacho (RF-29).
export async function guardarCategoriaCliente(clienteId: string, datos: FormData): Promise<{ error?: string }> {
  const r = await rolDecisor();
  if ("error" in r) return { error: r.error };
  const nombre = String(datos.get("nombre") ?? "").trim();
  if (!nombre || nombre.length > 60) return { error: "El nombre es obligatorio (máximo 60 caracteres)." };
  // El cliente debe ser de este despacho (la consulta usa la sesión, así que RLS también lo limita).
  const { data: cliente } = await r.supabase
    .from("clientes").select("id").eq("id", clienteId).eq("despacho_id", r.despachoId).maybeSingle();
  if (!cliente) return { error: "Cliente no encontrado." };
  // H3: el cliente ve sus categorías y las del despacho; ninguna de esas puede llamarse igual (sin importar mayúsculas).
  const { data: repetidas } = await r.supabase
    .from("categoria").select("cliente_id")
    .eq("despacho_id", r.despachoId)
    .or(`cliente_id.is.null,cliente_id.eq.${clienteId}`)
    .ilike("nombre", nombre.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1);
  if (repetidas && repetidas.length > 0) {
    return {
      error: repetidas[0].cliente_id
        ? "Este cliente ya tiene una categoría con ese nombre."
        : "Ya hay una categoría del despacho con ese nombre: úsala o elige otro nombre.",
    };
  }
  const { error } = await r.supabase.from("categoria").insert({
    despacho_id: r.despachoId, cliente_id: clienteId, nombre, deducible_default: datos.get("deducible") === "on",
  });
  if (error) {
    return { error: error.code === "CT001" ? "Ya hay una categoría con ese nombre para este cliente." : "No se pudo guardar la categoría." };
  }
  revalidatePath(`/clientes/${clienteId}`);
  return {};
}

// Consulta de nuevo al SAT las facturas del mes en curso del cliente (RF-22). Cuando exista el periodo (S3-09),
// se usará el periodo abierto en lugar del mes.
// Vuelve a consultar al SAT todas las facturas de un periodo abierto del cliente (C8, RF-22), antes de cerrarlo,
// para detectar cancelaciones posteriores. Las que el SAT reporta canceladas salen del resumen con su motivo.
// Un periodo cerrado no se consulta: sus facturas ya no cambian (RN-07). Las facturas excluidas ya están fuera.
export async function reconsultarPeriodo(
  clienteId: string,
  mesAnio: string,
): Promise<{ ok: boolean; texto: string; nuevasCanceladas?: number }> {
  const r = await rolDecisor();
  if ("error" in r) return { ok: false, texto: r.error ?? "No tienes permiso para esto." };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesAnio)) return { ok: false, texto: "Periodo no válido." };

  const { data: periodo } = await r.supabase
    .from("periodo").select("id, estado")
    .eq("cliente_id", clienteId).eq("mes_anio", mesAnio).maybeSingle();
  if (!periodo) return { ok: false, texto: "No se encontró ese periodo del cliente." };
  if (periodo.estado !== "abierto") return { ok: false, texto: "El periodo está cerrado: sus facturas ya no se consultan." };

  const { data: facturas, error } = await r.supabase
    .from("factura").select("archivo_id")
    .eq("periodo_id", periodo.id).neq("estado_revision", "excluido")
    .limit(500);
  if (error) return { ok: false, texto: "No se pudieron leer las facturas del periodo." };
  const lista = facturas ?? [];

  // Hasta 4 consultas a la vez: más rápido que una por una sin saturar al SAT.
  const resultados: Reconsulta[] = [];
  for (let i = 0; i < lista.length; i += 4) {
    resultados.push(...(await Promise.all(lista.slice(i, i + 4).map((f) => consultarDeNuevo(f.archivo_id)))));
  }
  const cuenta = (filtro: (x: Reconsulta) => boolean) => resultados.filter(filtro).length;
  const nuevasCanceladas = cuenta((x) => Boolean(x.nuevaCancelada));
  const vigentes = cuenta((x) => x.estado === "vigente");
  const noEncontradas = cuenta((x) => x.estado === "no_encontrada");
  const sinRespuesta = cuenta((x) => Boolean(x.sinRespuesta));
  const otrosErrores = cuenta((x) => !x.ok && !x.sinRespuesta);

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath(`/clientes/${clienteId}/periodos`);
  revalidatePath(`/clientes/${clienteId}/periodos/${mesAnio}`);
  revalidatePath("/resumen");

  const partes = [
    `Se consultaron ${lista.length} ${lista.length === 1 ? "factura" : "facturas"} del periodo.`,
    `Vigentes: ${vigentes}.`,
    `Canceladas nuevas: ${nuevasCanceladas}${nuevasCanceladas > 0 ? " (ya salieron del resumen con su motivo)" : ""}.`,
    noEncontradas > 0 ? `No encontradas: ${noEncontradas}.` : "",
    sinRespuesta > 0 ? `Sin respuesta del SAT: ${sinRespuesta}; vuelve a intentarlo.` : "",
    otrosErrores > 0 ? `No se pudieron consultar: ${otrosErrores}.` : "",
  ];
  return { ok: sinRespuesta === 0 && otrosErrores === 0, texto: partes.filter(Boolean).join(" "), nuevasCanceladas };
}

// PDF o foto subidos desde la ficha del cliente: se leen igual que en la bandeja de entrada.
// Si el PDF es una factura del cliente, queda como factura (con consulta al SAT). Si no, queda por revisar.
export async function procesarDocumentoArchivo(archivoId: string): Promise<{ ok: boolean; texto: string }> {
  const supabase = await supabaseServidor();
  const { data: archivo } = await supabase
    .from("archivo").select("id, cliente_id, tipo, ruta_original, estado")
    .eq("id", archivoId).maybeSingle();
  if (!archivo || (archivo.tipo !== "pdf" && archivo.tipo !== "imagen") || archivo.estado !== "recibido") {
    return { ok: false, texto: "El archivo no está disponible para leerse" };
  }
  const { data: cliente } = await supabase.from("clientes").select("rfc").eq("id", archivo.cliente_id).maybeSingle();
  if (!cliente) return { ok: false, texto: "No se encontró el cliente" };
  const admin = supabaseAdmin();
  const { data: descarga } = await admin.storage.from("facturas").download(archivo.ruta_original);
  if (!descarga) return { ok: false, texto: "No se pudo abrir el archivo" };
  const bytes = new Uint8Array(await descarga.arrayBuffer());

  try {
    if (archivo.tipo === "pdf") {
      const pdf = await import("@/lib/pdf");
      const leido = pdf.leerFacturaPdf(await pdf.leerTextoPdf(bytes));
      if (!("error" in leido)) {
        const rfc = cliente.rfc.toUpperCase();
        if (leido.factura.rfc_emisor.toUpperCase() !== rfc && leido.factura.rfc_receptor.toUpperCase() !== rfc) {
          await admin.from("archivo").update({ estado: "error", motivo_error: "El RFC del cliente no aparece en el PDF" }).eq("id", archivoId);
          await registrarHistorial(archivoId, "error", "El RFC del cliente no aparece en el PDF");
          return { ok: false, texto: "El RFC del cliente no aparece en el PDF" };
        }
        const r = await guardarFacturaDePdf(archivoId, archivo.cliente_id, cliente.rfc, leido);
        revalidatePath(`/clientes/${archivo.cliente_id}`);
        return { ok: r.bien, texto: r.texto };
      }
    }
    // Las fotos desde la ficha del cliente quedan para revisión; el OCR corre en la bandeja de entrada.
  } catch {
    // si no se pudo leer como factura, queda como documento para revisar
  }
  await admin.from("archivo").update({ estado: "por_revisar" }).eq("id", archivoId);
  await registrarHistorial(archivoId, "por_revisar", "Documento para revisar");
  revalidatePath(`/clientes/${archivo.cliente_id}`);
  return { ok: true, texto: "Guardado para revisión" };
}
