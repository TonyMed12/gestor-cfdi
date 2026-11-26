"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase-servidor";

// H3: las claves aplican a todo el despacho, así que su categoría debe ser del despacho, nunca la propia de un cliente.
async function esCategoriaDelDespacho(supabase: Awaited<ReturnType<typeof supabaseServidor>>, categoriaId: string) {
  const { data } = await supabase.from("categoria").select("id").eq("id", categoriaId).is("cliente_id", null).maybeSingle();
  return Boolean(data);
}
const NO_ES_DEL_DESPACHO = "Esa categoría es propia de un cliente: a una clave solo se le asignan categorías del despacho.";

// Asigna (o quita, si categoriaId viene vacío) la categoría de una clave del SAT en el despacho.
// RLS (script 11) solo deja cambiar a administrador y contador; aquí se revisa antes.
export async function guardarClaveCategoria(
  clave: string,
  categoriaId: string,
): Promise<{ error?: string }> {
  if (!/^\d{8}$/.test(clave)) return { error: "Clave del SAT no válida." };

  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." };

  const { data: yo } = await supabase
    .from("usuario")
    .select("despacho_id, rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden clasificar claves." };
  }

  if (categoriaId === "") {
    const { error } = await supabase
      .from("clave_categoria")
      .delete()
      .eq("despacho_id", yo.despacho_id)
      .eq("clave", clave);
    if (error) return { error: "No se pudo quitar la categoría." };
  } else {
    if (!(await esCategoriaDelDespacho(supabase, categoriaId))) return { error: NO_ES_DEL_DESPACHO };
    const { error } = await supabase
      .from("clave_categoria")
      .upsert(
        { despacho_id: yo.despacho_id, clave, categoria_id: categoriaId },
        { onConflict: "despacho_id,clave" },
      );
    if (error) return { error: "No se pudo guardar la categoría de esta clave." };
  }

  revalidatePath("/claves");
  return {};
}

// No se exporta: un archivo "use server" solo puede exportar funciones asíncronas.
const MAXIMO_CLAVES_EN_LOTE = 500;

// Asigna la misma categoría a varias claves en un solo paso (A4). Se guardan juntas: o quedan todas o ninguna.
// El trigger de clave_categoria (scripts 11 y 16) actualiza las facturas pendientes; las aprobadas no cambian.
export async function guardarClavesCategoria(
  claves: string[],
  categoriaId: string,
): Promise<{ error?: string; asignadas?: number }> {
  const unicas = [...new Set(claves)];
  if (unicas.length === 0) return { error: "Selecciona al menos una clave." };
  if (unicas.length > MAXIMO_CLAVES_EN_LOTE) {
    return { error: `Selecciona como máximo ${MAXIMO_CLAVES_EN_LOTE} claves a la vez.` };
  }
  if (!unicas.every((c) => /^\d{8}$/.test(c))) return { error: "Hay una clave del SAT no válida." };
  if (!categoriaId) return { error: "Elige la categoría que quieres asignar." };

  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." };

  const { data: yo } = await supabase
    .from("usuario")
    .select("despacho_id, rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden clasificar claves." };
  }

  // RLS (script 11) también revisa que la categoría sea del despacho.
  if (!(await esCategoriaDelDespacho(supabase, categoriaId))) return { error: NO_ES_DEL_DESPACHO };
  const { error } = await supabase
    .from("clave_categoria")
    .upsert(
      unicas.map((clave) => ({ despacho_id: yo.despacho_id, clave, categoria_id: categoriaId })),
      { onConflict: "despacho_id,clave" },
    );
  if (error) return { error: "No se pudo guardar la categoría de las claves seleccionadas." };

  revalidatePath("/claves");
  return { asignadas: unicas.length };
}
