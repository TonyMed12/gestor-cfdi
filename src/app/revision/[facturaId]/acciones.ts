"use server";

import { revalidatePath } from "next/cache";
import { registrarAccion } from "@/lib/bitacora";
import { getCategorias, getFacturaPorId } from "@/lib/datos";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServidor } from "@/lib/supabase-servidor";

// Solo administrador y contador deciden. RLS limita la factura a su despacho.
async function permisoDecidir(facturaId: string) {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." } as const;
  const { data: yo } = await supabase.from("usuario").select("rol").eq("id", user.id).maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden clasificar facturas." } as const;
  }
  const { data: factura } = await supabase.from("factura").select("id, archivo_id").eq("id", facturaId).maybeSingle();
  if (!factura) return { error: "No se encontró la factura." } as const;
  return { supabase, userId: user.id, archivoId: factura.archivo_id as string };
}

// Aprueba la clasificación: fija la categoría de cada concepto y la factura queda "Clasificado".
// `corregidas` trae conceptoId → categoriaId para los conceptos que el contador cambió.
export async function aprobarFactura(
  facturaId: string,
  corregidas: Record<string, string> = {},
): Promise<{ error?: string }> {
  return aprobar(facturaId, corregidas);
}

// Aprobación de una factura. `detalle` agrega datos a la bitácora (por ejemplo, que fue en lote).
async function aprobar(
  facturaId: string,
  corregidas: Record<string, string>,
  detalle: Record<string, unknown> = {},
): Promise<{ error?: string }> {
  const permiso = await permisoDecidir(facturaId);
  if ("error" in permiso) return { error: permiso.error };

  const factura = await getFacturaPorId(facturaId);
  if (!factura) return { error: "No se encontró la factura." };
  // Categorías del despacho y las propias del cliente (RLS de la sesión).
  const categorias = await getCategorias(factura.clienteId);
  const idPorNombre = new Map(categorias.map((c) => [c.nombre, c.id]));
  const nombrePorId = new Map(categorias.map((c) => [c.id, c.nombre]));
  const permitidas = new Set(categorias.map((c) => c.id));
  for (const categoriaId of Object.values(corregidas)) {
    if (!permitidas.has(categoriaId)) return { error: "Categoría no válida." };
  }

  // Todos los conceptos deben tener categoría antes de aprobar. Solo se escriben los de esta factura.
  const fijados: { conceptoId: string; categoriaId: string }[] = [];
  for (const c of factura.conceptos) {
    if (!c.id) continue;
    const categoriaId = corregidas[c.id] ?? (c.categoria ? idPorNombre.get(c.categoria) : undefined);
    if (!categoriaId) return { error: `Falta la categoría del concepto «${c.descripcion}».` };
    fijados.push({ conceptoId: c.id, categoriaId });
  }

  // Primero la bitácora: si no se puede registrar, no se cambia nada.
  try {
    await registrarAccion(
      permiso.supabase,
      Object.keys(corregidas).length > 0 ? "corrigio" : "aprobo",
      { conceptos_corregidos: Object.keys(corregidas).length, ...detalle },
      facturaId,
    );
  } catch {
    return { error: "No se pudo registrar la decisión. Intenta de nuevo." };
  }

  const admin = supabaseAdmin();
  const conceptoPorId = new Map(factura.conceptos.filter((c) => c.id).map((c) => [c.id as string, c]));
  const historial: { concepto_id: string; categoria_anterior: string | null; categoria_nueva: string; cambiado_por: string }[] = [];
  for (const f of fijados) {
    const { error } = await admin
      .from("concepto").update({ categoria_id: f.categoriaId })
      .eq("id", f.conceptoId).eq("factura_id", facturaId);
    if (error) return { error: "No se pudo guardar la clasificación." };
    // Solo cuenta como reclasificación si el contador cambió la categoría que se veía.
    const anterior = conceptoPorId.get(f.conceptoId)?.categoria ?? null;
    const nueva = nombrePorId.get(f.categoriaId) ?? "";
    if (f.conceptoId in corregidas && anterior !== nueva) {
      historial.push({ concepto_id: f.conceptoId, categoria_anterior: anterior, categoria_nueva: nueva, cambiado_por: permiso.userId });
    }
  }
  if (historial.length > 0) await admin.from("clasificacion_historial").insert(historial);
  const { error } = await permiso.supabase
    .from("factura").update({ estado_revision: "clasificado" }).eq("id", facturaId);
  if (error) return { error: "No se pudo aprobar la factura." };
  // La vista de clientes cuenta por estado del archivo: también debe cambiar.
  await admin.from("archivo").update({ estado: "clasificado" }).eq("id", permiso.archivoId);

  revalidatePath("/bandeja");
  revalidatePath(`/revision/${facturaId}`);
  revalidatePath("/resumen");
  return {};
}

export type ResultadoLote = {
  error?: string;
  aprobadas: { id: string; descripcion: string }[];
  noAprobadas: { id: string; descripcion: string; motivo: string }[];
};

// No se exporta: un archivo "use server" solo puede exportar funciones asíncronas.
const MAXIMO_FACTURAS_EN_LOTE = 100;

// Aprueba varias facturas de la bandeja (A6). Solo se aprueban las que siguen por revisar y tienen
// todos sus conceptos clasificados; las demás se informan con su motivo y no cambian.
// Cada aprobación es igual que aprobar una por una: con las categorías propuestas y su registro en la bitácora.
export async function aprobarFacturasEnLote(facturaIds: string[]): Promise<ResultadoLote> {
  const unicas = [...new Set(facturaIds)];
  if (unicas.length === 0) return { error: "Selecciona al menos una factura.", aprobadas: [], noAprobadas: [] };
  if (unicas.length > MAXIMO_FACTURAS_EN_LOTE) {
    return { error: `Selecciona como máximo ${MAXIMO_FACTURAS_EN_LOTE} facturas a la vez.`, aprobadas: [], noAprobadas: [] };
  }
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!unicas.every((id) => esUuid.test(id))) return { error: "Hay una factura no válida.", aprobadas: [], noAprobadas: [] };

  const resultado: ResultadoLote = { aprobadas: [], noAprobadas: [] };
  for (const id of unicas) {
    const factura = await getFacturaPorId(id);
    if (!factura) {
      resultado.noAprobadas.push({ id, descripcion: "Factura", motivo: "No se encontró la factura." });
      continue;
    }
    const descripcion = `${factura.relacion === "recibida" ? factura.emisorNombre : factura.receptorNombre} · $${factura.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
    if (factura.estadoRevision !== "por_revisar") {
      resultado.noAprobadas.push({ id, descripcion, motivo: "Ya no está por revisar." });
      continue;
    }
    const sinCategoria = factura.conceptos.filter((c) => !c.categoria).length;
    if (sinCategoria > 0) {
      resultado.noAprobadas.push({
        id,
        descripcion,
        motivo: sinCategoria === 1 ? "Tiene 1 concepto sin categoría." : `Tiene ${sinCategoria} conceptos sin categoría.`,
      });
      continue;
    }
    const r = await aprobar(id, {}, { en_lote: true });
    if (r.error) resultado.noAprobadas.push({ id, descripcion, motivo: r.error });
    else resultado.aprobadas.push({ id, descripcion });
  }
  revalidatePath("/bandeja");
  return resultado;
}

// Rechaza la factura: sale de la clasificación y del resumen, con un motivo (RF-40).
export async function rechazarFactura(facturaId: string, motivo: string): Promise<{ error?: string }> {
  const texto = motivo.trim();
  if (!texto) return { error: "Escribe el motivo del rechazo." };
  if (texto.length > 200) return { error: "El motivo no puede pasar de 200 caracteres." };

  const permiso = await permisoDecidir(facturaId);
  if ("error" in permiso) return { error: permiso.error };

  try {
    await registrarAccion(permiso.supabase, "corrigio", { decision: "rechazada", motivo: texto }, facturaId);
  } catch {
    return { error: "No se pudo registrar la decisión. Intenta de nuevo." };
  }
  const { error } = await permiso.supabase
    .from("factura")
    .update({ estado_revision: "excluido", motivo_exclusion: texto })
    .eq("id", facturaId);
  if (error) return { error: "No se pudo rechazar la factura." };
  // Igual que una factura excluida desde XML: el archivo queda con error y el motivo.
  await supabaseAdmin().from("archivo")
    .update({ estado: "error", motivo_error: `Rechazada: ${texto}` }).eq("id", permiso.archivoId);

  revalidatePath("/bandeja");
  revalidatePath(`/revision/${facturaId}`);
  revalidatePath("/resumen");
  return {};
}
