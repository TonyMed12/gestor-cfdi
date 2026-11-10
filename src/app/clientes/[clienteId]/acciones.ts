"use server";

import { revalidatePath } from "next/cache";
import { leerCfdi } from "@/lib/cfdi";
import { supabaseServidor } from "@/lib/supabase-servidor";

// Lee un XML ya subido: valida el CFDI y guarda la factura con sus conceptos e impuestos.
export async function procesarXml(archivoId: string): Promise<{ ok: boolean; texto: string }> {
  const supabase = await supabaseServidor();

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

  const { error } = await supabase.rpc("guardar_factura", {
    p_archivo: archivoId,
    p_factura: { ...factura, relacion, motivo_exclusion: leido.exclusion },
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
  if (leido.exclusion) return { ok: false, texto: `Leída, pero excluida: ${leido.exclusion}` };
  const total = Number(factura.total).toLocaleString("es-MX", { style: "currency", currency: factura.moneda });
  return { ok: true, texto: `Guardado y leído: ${factura.rfc_emisor} → ${factura.rfc_receptor} · ${total}` };
}

// Enlace que vence en 60 segundos para abrir un archivo privado.
// Storage aplica los permisos de la persona en sesión, así que no abre archivos de otros despachos.
export async function urlArchivo(ruta: string): Promise<{ url?: string; error?: string }> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.storage.from("facturas").createSignedUrl(ruta, 60);
  if (error || !data) return { error: "No se pudo abrir el archivo." };
  return { url: data.signedUrl };
}
