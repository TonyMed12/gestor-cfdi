"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase-servidor";

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
