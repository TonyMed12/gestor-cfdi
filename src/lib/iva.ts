// Regla del IVA acreditable (C4). Sin dependencias: la usan el resumen del periodo (resumen.ts) y la
// revisión de una factura (deducibilidad.ts), y se prueba sola en pruebas/iva-acreditable.test.mjs.

// factor: "Tasa" (lo normal en IVA), "Cuota" o "Exento". Hoy la lectura del XML no guarda los exentos ni el
// factor (cfdi.ts los omite), así que llega vacío; la regla ya los trata por si se guardan después.
export type ImpuestoIva = { tipo: string; impuesto: string; tasa: number; importe: number; factor?: string };

// Tasas de IVA vigentes que generan IVA acreditable: general (16 %) y región fronteriza (8 %).
// La tasa 0 % es válida, pero no genera IVA que acreditar.
export const TASAS_IVA_ACREDITABLES = [0.16, 0.08] as const;

export type IvaAcreditable = { importe: number; motivo: string | null };

// Es la única función que decide si el IVA de un impuesto se acredita. Se acredita solo si:
//   1. Es IVA trasladado (el retenido no se acredita aquí; el IEPS no es IVA).
//   2. La factura es recibida: es un gasto del cliente, no un ingreso.
//   3. No es exento y la tasa es una tasa vigente que genera IVA (16 % u 8 %). Con 0 % no hay IVA que acreditar.
//   4. El gasto es deducible: marca de la factura o, si no tiene, la de su categoría (A7, esDeducible).
// Devuelve el importe acreditable (en pesos, del mismo signo que el impuesto) y, si es cero, el motivo.
export function ivaAcreditable(p: {
  relacion: "emitida" | "recibida";
  deducible: boolean;
  impuesto: ImpuestoIva;
}): IvaAcreditable {
  const i = p.impuesto;
  if (i.impuesto !== "IVA" || i.tipo !== "trasladado") return { importe: 0, motivo: "No es IVA trasladado" };
  if (p.relacion !== "recibida") return { importe: 0, motivo: "Factura emitida: su IVA es trasladado, no acreditable" };
  if (i.factor === "Exento") return { importe: 0, motivo: "Exento: no genera IVA acreditable" };
  if (i.tasa === 0) return { importe: 0, motivo: "Tasa 0 %: no genera IVA acreditable" };
  if (!TASAS_IVA_ACREDITABLES.some((t) => Math.abs(i.tasa - t) < 1e-6)) {
    return { importe: 0, motivo: `Tasa de IVA no válida (${Math.round(i.tasa * 10000) / 100} %)` };
  }
  if (!p.deducible) return { importe: 0, motivo: "Gasto no deducible" };
  return { importe: i.importe, motivo: null };
}
