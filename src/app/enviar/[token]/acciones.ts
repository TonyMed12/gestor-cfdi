"use server";

import { headers } from "next/headers";
import {
  abrirSesion, bloqueoDeIp, buscarAcceso, contrasenaCoincide, huellaIp, MAX_INTENTOS, MINUTOS_BLOQUEO,
  normalizarContrasena, registrarFalloDeIp, venció,
} from "@/lib/enlace";
import { ipDeLaPeticion, mensajeBloqueoIp } from "@/lib/limite-ip";
import { supabaseAdmin } from "@/lib/supabase-admin";

// El cliente escribe la contraseña temporal. Si acierta, recibe una sesión de unas horas.
// Dos límites (G6): por enlace (5 intentos, 15 minutos) y por conexión (10 intentos fallidos en 15 minutos, contando
// todos los enlaces). El de la conexión se revisa primero y aplica aunque la contraseña sea correcta.
export async function desbloquearEnlace(token: string, contrasena: string): Promise<{ error?: string }> {
  const ip = huellaIp(ipDeLaPeticion(await headers()));
  const bloqueo = await bloqueoDeIp(ip);
  if (bloqueo.bloqueada) return { error: mensajeBloqueoIp(bloqueo.minutos) };
  // Cualquier rechazo de aquí en adelante cuenta como intento fallido de esta conexión.
  const fallar = async (error: string) => {
    await registrarFalloDeIp(ip);
    return { error };
  };

  if (!/^[a-f0-9]{48}$/.test(token)) return fallar("Este enlace no es válido.");
  const acceso = await buscarAcceso(token);
  if (!acceso) return fallar("Este enlace no es válido o ya fue reemplazado.");
  if (venció(acceso)) return { error: "Este enlace venció. Pide uno nuevo a tu contador." };
  if (!acceso.password_hash) return { error: "Este enlace ya no tiene contraseña. Pide uno nuevo a tu contador." };

  const ahora = Date.now();
  if (acceso.bloqueado_hasta && new Date(acceso.bloqueado_hasta).getTime() > ahora) {
    return fallar(`Demasiados intentos. Espera ${MINUTOS_BLOQUEO} minutos y vuelve a intentar.`);
  }

  const admin = supabaseAdmin();
  if (!contrasenaCoincide(normalizarContrasena(contrasena), acceso.password_hash)) {
    const intentos = acceso.intentos_fallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await admin.from("enlace_acceso").update({
      intentos_fallidos: bloquear ? 0 : intentos,
      bloqueado_hasta: bloquear ? new Date(ahora + MINUTOS_BLOQUEO * 60_000).toISOString() : null,
    }).eq("token", token);
    return fallar(
      bloquear
        ? `Demasiados intentos. Espera ${MINUTOS_BLOQUEO} minutos y vuelve a intentar.`
        : "La contraseña no es correcta.",
    );
  }

  await admin.from("enlace_acceso").update({ intentos_fallidos: 0, bloqueado_hasta: null }).eq("token", token);
  await abrirSesion(token);
  return {};
}
