// Cierre de periodo (D4, RF-43, RN-07). Reglas que comparten las acciones y las pantallas.
// Las mismas reglas están en la base (supabase/22-cierre-de-periodo.sql); aquí se dan mensajes claros antes.
// Sin dependencias, para probarlas solas (pruebas/cierre.test.mjs).

export const MOTIVO_MINIMO = 5; // igual que en hay_motivo_periodo_cerrado (script 22)
export const MOTIVO_MAXIMO = 300;

// Motivo de un cambio en un periodo cerrado: obligatorio, de 5 a 300 caracteres, sin espacios de más.
export function leerMotivoCierre(texto: string | undefined): { motivo: string } | { error: string } {
  const motivo = (texto ?? "").replace(/\s+/g, " ").trim();
  if (motivo.length < MOTIVO_MINIMO) {
    return { error: "El periodo de esta factura está cerrado: escribe el motivo del cambio (al menos 5 letras)." };
  }
  if (motivo.length > MOTIVO_MAXIMO) return { error: `El motivo no puede pasar de ${MOTIVO_MAXIMO} caracteres.` };
  return { motivo };
}

// ¿Se puede cerrar? Solo sin facturas por revisar ni por confirmar: si no, el resumen estaría incompleto.
export function puedeCerrar(conteo: { porRevisar: number; porConfirmar: number }): { ok: true } | { ok: false; motivo: string } {
  const pendientes = conteo.porRevisar + conteo.porConfirmar;
  if (pendientes === 0) return { ok: true };
  return {
    ok: false,
    motivo:
      pendientes === 1
        ? "Falta 1 factura por revisar: apruébala o recházala antes de cerrar."
        : `Faltan ${pendientes} facturas por revisar: apruébalas o recházalas antes de cerrar.`,
  };
}

// «Cerrado el 25 nov 2026, 8:30 p.m. por Tony Medina.» para la cabecera del resumen y del periodo.
export function describirCierre(cerradoEn: string | null, cerradoPor: string | null): string {
  const cuando = cerradoEn
    ? ` el ${new Date(cerradoEn).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" })}`
    : "";
  return `Periodo cerrado${cuando}${cerradoPor ? ` por ${cerradoPor}` : ""}.`;
}

// Traduce los errores de la base del script 22 (PC001, PC002, PC003) a un mensaje para la persona.
export function mensajeErrorCierre(error: { code?: string; message?: string } | null | undefined): string | undefined {
  switch (error?.code) {
    case "PC001":
      return "La factura es de un periodo cerrado: el cambio necesita un motivo.";
    case "PC002":
      return error.message ?? "El periodo tiene facturas por revisar: apruébalas o recházalas antes de cerrar.";
    case "PC003":
      return "Un periodo cerrado no se puede reabrir ni editar.";
    default:
      return undefined;
  }
}
