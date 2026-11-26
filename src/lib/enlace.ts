import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { bloqueoPorIp, MAX_FALLOS_POR_IP, MINUTOS_VENTANA_IP } from "@/lib/limite-ip";

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
  cliente_activo: boolean; // H2: un cliente desactivado no recibe facturas nuevas, tampoco por su enlace
};

export const MENSAJE_CLIENTE_INACTIVO =
  "Este enlace ya no recibe facturas porque el cliente está desactivado. Comunícate con tu contador.";

// Busca el acceso por token con la clave de servicio: la tabla no tiene políticas para usuarios.
export async function buscarAcceso(token: string): Promise<AccesoEnlace | null> {
  const { data } = await supabaseAdmin()
    .from("enlace_acceso")
    .select("cliente_id, token, password_hash, vence_en, intentos_fallidos, bloqueado_hasta, clientes(activo)")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const { clientes, ...acceso } = data as typeof data & { clientes: { activo: boolean } | null };
  return { ...acceso, cliente_activo: clientes?.activo ?? false };
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

// ---------- Límite por dirección IP (G6) ----------
// Se guarda una huella de la IP (HMAC con una clave del servidor), no la IP: así no se almacena la dirección del cliente.
export const huellaIp = (ip: string) =>
  createHmac("sha256", createHash("sha256").update(`ip-enlace:${clave().toString("hex")}`).digest()).update(ip).digest("hex");

// ¿Esta conexión ya agotó sus intentos? Si la tabla no se puede leer (por ejemplo, falta el script 25), no se bloquea:
// el bloqueo por enlace sigue funcionando y el error queda en el registro del servidor.
export async function bloqueoDeIp(ipHuella: string) {
  const desde = new Date(Date.now() - MINUTOS_VENTANA_IP * 60_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("intento_enlace").select("creado_en").eq("ip_huella", ipHuella).gt("creado_en", desde)
    .order("creado_en", { ascending: false }).limit(MAX_FALLOS_POR_IP);
  if (error) {
    console.error("Límite por IP del enlace:", error.message);
    return { bloqueada: false } as const;
  }
  return bloqueoPorIp(data.map((d) => new Date(d.creado_en)), new Date());
}

// Registra un intento fallido de esta conexión y borra los de más de un día.
export async function registrarFalloDeIp(ipHuella: string) {
  const admin = supabaseAdmin();
  const { error } = await admin.from("intento_enlace").insert({ ip_huella: ipHuella });
  if (error) console.error("Límite por IP del enlace:", error.message);
  await admin.from("intento_enlace").delete().lt("creado_en", new Date(Date.now() - 86_400_000).toISOString());
}
