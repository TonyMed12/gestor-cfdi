import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Enlace de envío del cliente (RF-04): token en la dirección + contraseña temporal + sesión firmada.

export const DIAS_VIGENCIA = 30;
export const HORAS_SESION = 2;
export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;
const NOMBRE_COOKIE = "sesion_enlace";
// Sin I, L, O, 0 y 1: no se confunden al leerlas o dictarlas.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const generarToken = () => randomBytes(24).toString("hex");

export const generarContrasena = () =>
  Array.from({ length: 10 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

export const normalizarContrasena = (c: string) => c.trim().toUpperCase();

export function hashContrasena(contrasena: string) {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString("hex")}$${scryptSync(contrasena, sal, 32).toString("hex")}`;
}

export function contrasenaCoincide(contrasena: string, guardado: string) {
  const [alg, salHex, hashHex] = guardado.split("$");
  if (alg !== "scrypt" || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const obtenido = scryptSync(contrasena, Buffer.from(salHex, "hex"), esperado.length);
  return timingSafeEqual(obtenido, esperado);
}

export type AccesoEnlace = {
  cliente_id: string;
  token: string;
  password_hash: string | null;
  vence_en: string;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
};

// Busca el acceso por token con la clave de servicio: la tabla no tiene políticas para usuarios.
export async function buscarAcceso(token: string): Promise<AccesoEnlace | null> {
  const { data } = await supabaseAdmin()
    .from("enlace_acceso")
    .select("cliente_id, token, password_hash, vence_en, intentos_fallidos, bloqueado_hasta")
    .eq("token", token)
    .maybeSingle();
  return data ?? null;
}

export const venció = (acceso: AccesoEnlace) => new Date(acceso.vence_en).getTime() < Date.now();

// La firma usa la clave de servicio (solo existe en el servidor). El token va dentro:
// al regenerar el enlace, las sesiones anteriores dejan de valer.
const clave = () => {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  return createHash("sha256").update(`sesion-enlace:${base}`).digest();
};
const firma = (datos: string) => createHmac("sha256", clave()).update(datos).digest("base64url");

export async function abrirSesion(token: string) {
  const expira = Date.now() + HORAS_SESION * 3600_000;
  const datos = `${token}.${expira}`;
  (await cookies()).set(NOMBRE_COOKIE, `${datos}.${firma(datos)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/enviar",
    maxAge: HORAS_SESION * 3600,
  });
}

export async function sesionValida(token: string): Promise<boolean> {
  const valor = (await cookies()).get(NOMBRE_COOKIE)?.value;
  if (!valor) return false;
  const [t, expira, sig] = valor.split(".");
  if (t !== token || !sig || Number(expira) < Date.now()) return false;
  const esperado = firma(`${t}.${expira}`);
  return sig.length === esperado.length && timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
}
