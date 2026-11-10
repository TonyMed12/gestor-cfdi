"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServidor } from "@/lib/supabase-servidor";

const ROLES = ["administrador", "contador", "auxiliar"];

// El permiso se comprueba en el servidor; el navegador no es de fiar.
async function administradorActual() {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Inicia sesión de nuevo." };
  const { data: yo } = await supabase
    .from("usuario")
    .select("rol, activo, despacho_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!yo?.activo || yo.rol !== "administrador") {
    return { error: "No tienes permiso para administrar usuarios." };
  }
  return { supabase, user, despachoId: yo.despacho_id as string };
}

export async function crearUsuario(datos: FormData): Promise<{ error?: string }> {
  const nombre = String(datos.get("nombre") ?? "").trim();
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();
  const rol = String(datos.get("rol") ?? "");
  const contrasena = String(datos.get("contrasena") ?? "");

  if (!nombre || !/^\S+@\S+\.\S+$/.test(correo)) {
    return { error: "Escribe un nombre y un correo válido." };
  }
  if (!ROLES.includes(rol)) return { error: "Elige un rol." };
  if (contrasena.length < 8) {
    return { error: "La contraseña temporal debe tener al menos 8 caracteres." };
  }

  const sesion = await administradorActual();
  if ("error" in sesion) return { error: sesion.error };

  const admin = supabaseAdmin();
  const { data: creado, error: errorCuenta } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
  });
  if (errorCuenta || !creado.user) {
    return {
      error:
        errorCuenta?.code === "email_exists"
          ? "Ya existe una cuenta con ese correo."
          : "No se pudo crear la cuenta.",
    };
  }

  // La fila se inserta con la sesión del administrador, así que también pasa por RLS.
  const { error: errorFila } = await sesion.supabase.from("usuario").insert({
    id: creado.user.id,
    despacho_id: sesion.despachoId,
    nombre,
    correo,
    rol,
  });
  if (errorFila) {
    await admin.auth.admin.deleteUser(creado.user.id); // no deja cuentas sin fila en usuario
    return { error: "No se pudo guardar el usuario." };
  }

  revalidatePath("/usuarios");
  return {};
}

export async function cambiarEstadoUsuario(
  id: string,
  activo: boolean,
): Promise<{ error?: string }> {
  const sesion = await administradorActual();
  if ("error" in sesion) return { error: sesion.error };
  if (id === sesion.user.id) {
    return { error: "No puedes desactivar tu propia cuenta." };
  }

  // RLS limita el cambio a usuarios del mismo despacho: si no es de este despacho, no actualiza nada.
  const { data, error } = await sesion.supabase
    .from("usuario")
    .update({ activo })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return { error: "No se pudo actualizar el usuario." };

  // Además de la fila, se bloquea la cuenta para que no pueda iniciar sesión.
  const { error: errorCuenta } = await supabaseAdmin().auth.admin.updateUserById(id, {
    ban_duration: activo ? "none" : "876000h",
  });
  if (errorCuenta) {
    await sesion.supabase.from("usuario").update({ activo: !activo }).eq("id", id);
    return { error: "No se pudo cambiar el acceso de la cuenta." };
  }

  revalidatePath("/usuarios");
  return {};
}
