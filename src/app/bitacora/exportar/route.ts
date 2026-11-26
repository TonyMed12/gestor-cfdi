import { registrarAccion } from "@/lib/bitacora";
import { clientesEnDetalles } from "@/lib/bitacora-texto";
import { getPerfil } from "@/lib/datos";
import { csvBitacora, nombreCsvBitacora, type RegistroBitacora } from "@/lib/exportar-bitacora";
import { supabaseServidor } from "@/lib/supabase-servidor";

// Descarga de la bitácora en CSV (D7, RF-47): /bitacora/exportar. Solo el administrador.
// La base también lo impide: solo el administrador puede leer la bitácora, y solo la de su despacho (RLS).
const POR_LOTE = 1000; // Supabase entrega como máximo 1000 filas por consulta

export async function GET() {
  const perfil = await getPerfil();
  if (perfil?.rol !== "administrador") {
    return new Response("Solo el administrador puede descargar la bitácora.", { status: 403 });
  }
  const supabase = await supabaseServidor();

  // Toda la bitácora, de lo más reciente a lo más antiguo, en lotes de 1000.
  const registros: RegistroBitacora[] = [];
  for (let desde = 0; ; desde += POR_LOTE) {
    const { data, error } = await supabase
      .from("bitacora")
      .select("ocurrido_en, accion, detalle, usuario(nombre), factura(uuid_fiscal, nombre_emisor)")
      .order("ocurrido_en", { ascending: false })
      .order("id", { ascending: false })
      .range(desde, desde + POR_LOTE - 1);
    if (error) return new Response("No se pudo leer la bitácora. Intenta de nuevo.", { status: 500 });
    registros.push(...(data as unknown as RegistroBitacora[]));
    if (data.length < POR_LOTE) break;
  }

  // Nombres de los clientes de las exportaciones y cierres, para el detalle en palabras (RLS: solo los tuyos).
  const ids = clientesEnDetalles(registros.map((r) => r.detalle));
  const nombres = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from("clientes").select("id, razon_social").in("id", ids.slice(i, i + 200));
    for (const c of data ?? []) nombres.set(c.id as string, c.razon_social as string);
  }

  // D6: esta descarga también queda en la bitácora. Primero se registra; si no se puede, no se entrega.
  try {
    await registrarAccion(supabase, "exporto", { tipo: "bitacora", formato: "csv", registros: registros.length });
  } catch {
    return new Response("No se pudo registrar la exportación en la bitácora. Intenta de nuevo.", { status: 500 });
  }

  return new Response(csvBitacora(registros, nombres), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreCsvBitacora(new Date())}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
