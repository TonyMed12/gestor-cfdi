"use server";

import { revalidatePath } from "next/cache";
import { registrarAccion } from "@/lib/bitacora";
import { mensajeErrorCierre, puedeCerrar } from "@/lib/cierre";
import { esMesAnio } from "@/lib/formato";
import { supabaseServidor } from "@/lib/supabase-servidor";

// Cierra un periodo del cliente (D4, RF-43). Solo el administrador o el contador, y solo sin facturas por revisar.
// Después, aprobar, corregir o rechazar una factura del periodo pide un motivo que queda en la bitácora (RN-07).
// La base pone la fecha y quién lo cerró, y vuelve a revisar que no haya pendientes (supabase/22-cierre-de-periodo.sql).
export async function cerrarPeriodo(clienteId: string, mesAnio: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(clienteId) || !esMesAnio(mesAnio)) return { error: "Periodo no válido." };
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." };
  const { data: yo } = await supabase.from("usuario").select("rol").eq("id", user.id).maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden cerrar un periodo." };
  }

  // RLS: solo periodos de clientes de tu despacho.
  const { data: periodo } = await supabase
    .from("periodo")
    .select("id, estado, factura(estado_revision)")
    .eq("cliente_id", clienteId)
    .eq("mes_anio", mesAnio)
    .maybeSingle();
  if (!periodo) return { error: "No se encontró ese periodo del cliente." };
  if (periodo.estado === "cerrado") return { error: "El periodo ya está cerrado." };
  const estados = (periodo.factura as { estado_revision: string }[]).map((f) => f.estado_revision);
  const revision = puedeCerrar({
    porRevisar: estados.filter((e) => e === "por_revisar").length,
    porConfirmar: estados.filter((e) => e === "por_confirmar").length,
  });
  if (!revision.ok) return { error: revision.motivo };

  // Primero la bitácora: si no se puede registrar, no se cierra.
  try {
    await registrarAccion(supabase, "cerro_periodo", {
      cliente_id: clienteId,
      mes_anio: mesAnio,
      periodo_id: periodo.id,
      facturas: estados.length,
    });
  } catch {
    return { error: "No se pudo registrar el cierre. Intenta de nuevo." };
  }
  const { data: cerrado, error } = await supabase
    .from("periodo")
    .update({ estado: "cerrado" })
    .eq("id", periodo.id)
    .eq("estado", "abierto")
    .select("id");
  if (error) return { error: mensajeErrorCierre(error) ?? "No se pudo cerrar el periodo." };
  if (!cerrado?.length) return { error: "El periodo cambió mientras tanto. Recarga la página." };

  revalidatePath("/resumen");
  revalidatePath(`/clientes/${clienteId}/periodos`);
  revalidatePath(`/clientes/${clienteId}/periodos/${mesAnio}`);
  return {};
}
