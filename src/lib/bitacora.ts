import type { SupabaseClient } from "@supabase/supabase-js";

export type AccionBitacora = "subio" | "corrigio" | "aprobo" | "exporto" | "cerro_periodo";

// Registra una acción de la persona en sesión (RF-47). La base pone quién la hizo y cuándo.
export async function registrarAccion(
  cliente: SupabaseClient,
  accion: AccionBitacora,
  detalle?: Record<string, unknown>,
  facturaId?: string,
) {
  const { error } = await cliente
    .from("bitacora")
    .insert({ accion, detalle, factura_id: facturaId });
  if (error) throw new Error(`No se pudo registrar en la bitácora: ${error.message}`);
}
