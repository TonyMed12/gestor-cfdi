"use server";

import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase-servidor";

// Crear o editar una categoría del despacho. Sin id = crear; con id = editar.
// RLS deja crear y editar solo a administrador y contador (script 04); aquí se revisa lo mismo antes.
export async function guardarCategoria(datos: FormData): Promise<{ error?: string }> {
  const id = String(datos.get("id") ?? "");
  const nombre = String(datos.get("nombre") ?? "").trim();
  const deducible = datos.get("deducible") === "on";

  if (!nombre) return { error: "Escribe un nombre." };
  if (nombre.length > 60) return { error: "El nombre no puede pasar de 60 caracteres." };

  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." };

  const { data: yo } = await supabase
    .from("usuario")
    .select("despacho_id, rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!yo || !["administrador", "contador"].includes(yo.rol)) {
    return { error: "Solo el administrador o el contador pueden cambiar categorías." };
  }

  // Sin restricción única en la base: se revisa el nombre antes de guardar.
  const { data: repetida } = await supabase
    .from("categoria")
    .select("id")
    .eq("despacho_id", yo.despacho_id)
    .is("cliente_id", null)
    .ilike("nombre", nombre)
    .neq("id", id || "00000000-0000-0000-0000-000000000000")
    .limit(1);
  if (repetida && repetida.length > 0) {
    return { error: "Ya existe una categoría con ese nombre." };
  }

  if (id) {
    const { data, error } = await supabase
      .from("categoria")
      .update({ nombre, deducible_default: deducible })
      .eq("id", id)
      .is("cliente_id", null)
      .select("id");
    if (error) return { error: "No se pudo guardar la categoría." };
    if (data.length === 0) return { error: "No se encontró la categoría." };
  } else {
    const { error } = await supabase
      .from("categoria")
      .insert({ despacho_id: yo.despacho_id, nombre, deducible_default: deducible });
    if (error) return { error: "No se pudo crear la categoría." };
  }

  revalidatePath("/categorias");
  return {};
}
