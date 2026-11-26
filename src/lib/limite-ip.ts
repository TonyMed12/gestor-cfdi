// Límite por dirección IP en el enlace del cliente (G6). Reglas sin dependencias, para probarlas solas
// (pruebas/limite-ip.test.mjs). La parte que guarda y cuenta los intentos está en src/lib/enlace.ts (servidor).

export const MAX_FALLOS_POR_IP = 10;
export const MINUTOS_VENTANA_IP = 15;

// IP de quien hace la petición. Detrás del proveedor de hospedaje (por ejemplo, Vercel), la primera dirección de
// x-forwarded-for es la del visitante; en local llega x-real-ip o nada. Sin IP se usa "desconocida": todos esos
// intentos cuentan juntos, así que el límite se vuelve más estricto, nunca más débil.
export function ipDeLaPeticion(encabezados: { get(nombre: string): string | null }): string {
  const reenviada = encabezados.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = encabezados.get("x-real-ip")?.trim();
  const ip = reenviada || real || "";
  // Solo caracteres de una IPv4 o IPv6; cualquier otra cosa no se toma como IP.
  return /^[0-9a-fA-F.:]{2,45}$/.test(ip) ? ip.toLowerCase() : "desconocida";
}

// ¿Está bloqueada la IP? Con MAX_FALLOS_POR_IP fallos dentro de la ventana, sí, hasta que el más antiguo de esos
// fallos salga de la ventana. `fallos`: horas de los fallos recientes de esa IP.
export function bloqueoPorIp(fallos: Date[], ahora: Date): { bloqueada: false } | { bloqueada: true; minutos: number } {
  const inicio = ahora.getTime() - MINUTOS_VENTANA_IP * 60_000;
  const recientes = fallos.map((f) => f.getTime()).filter((t) => t > inicio).sort((a, b) => a - b);
  if (recientes.length < MAX_FALLOS_POR_IP) return { bloqueada: false };
  // Se libera cuando quedan MAX - 1 fallos en la ventana: al salir el que hace que sobren.
  const libera = recientes[recientes.length - MAX_FALLOS_POR_IP] + MINUTOS_VENTANA_IP * 60_000;
  return { bloqueada: true, minutos: Math.max(1, Math.ceil((libera - ahora.getTime()) / 60_000)) };
}

export const mensajeBloqueoIp = (minutos: number) =>
  `Demasiados intentos desde esta conexión. Espera ${minutos} ${minutos === 1 ? "minuto" : "minutos"} y vuelve a intentar.`;
