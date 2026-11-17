"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase-servidor";

const RFC_VALIDO = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

async function personaDecisora() {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." } as const;

  const { data: yo } = await supabase
    .from("usuario")
    .select("despacho_id, rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden crear reglas." } as const;
  }
  return { supabase, despacho_id: yo.despacho_id as string };
}

// Toda factura cuya contraparte tenga ese RFC se clasifica en la categoría elegida.
export async function guardarReglaEmisor(
  rfc: string,
  categoriaId: string,
): Promise<{ error?: string }> {
  const limpio = rfc.trim().toUpperCase();
  if (!RFC_VALIDO.test(limpio)) return { error: "El RFC no tiene un formato válido." };
  if (!categoriaId) return { error: "Elige una categoría." };

  const yo = await personaDecisora();
  if ("error" in yo) return { error: yo.error };

  const { error } = await yo.supabase
    .from("regla_emisor")
    .upsert(
      { despacho_id: yo.despacho_id, rfc: limpio, categoria_id: categoriaId },
      { onConflict: "despacho_id,rfc" },
    );
  if (error) return { error: "No se pudo guardar la regla." };

  revalidatePath("/reglas");
  revalidatePath("/bandeja");
  return {};
}

export async function eliminarReglaEmisor(rfc: string): Promise<{ error?: string }> {
  const yo = await personaDecisora();
  if ("error" in yo) return { error: yo.error };

  const { error } = await yo.supabase
    .from("regla_emisor")
    .delete()
    .eq("despacho_id", yo.despacho_id)
    .eq("rfc", rfc);
  if (error) return { error: "No se pudo borrar la regla." };

  revalidatePath("/reglas");
  revalidatePath("/bandeja");
  return {};
}
