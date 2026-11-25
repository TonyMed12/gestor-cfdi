// Deducibilidad por factura (A7). Se prueba sola en pruebas/deducibilidad.test.mjs.
// El IVA acreditable usa la regla única de iva.ts (C4).
// La extensión .ts en la importación permite correr las pruebas con node sin compilar (tsconfig: allowImportingTsExtensions).
import { ivaAcreditable, type ImpuestoIva } from "./iva.ts";

// Marca de la factura: null = según la categoría de cada concepto; true o false = decisión del contador.
export type MarcaDeducible = boolean | null;

// ¿Un concepto es deducible? La marca de la factura gana sobre la de su categoría.
// Sin marca ni categoría conocida se toma como deducible, igual que deducible_default en la base.
export const esDeducible = (marcaFactura: MarcaDeducible | undefined, deducibleCategoria: boolean | undefined): boolean =>
  marcaFactura ?? deducibleCategoria ?? true;

export type ConceptoDeducible = {
  importe: number;
  impuestos: ImpuestoIva[];
  deducibleCategoria: boolean | undefined;
};

// Gasto deducible e IVA acreditable de una factura según su deducibilidad.
// Una factura emitida es un ingreso: no tiene gasto deducible ni IVA acreditable.
export function deduccionesDeFactura(p: {
  relacion: "emitida" | "recibida";
  marca: MarcaDeducible | undefined;
  conceptos: ConceptoDeducible[];
}): { gastoDeducible: number; ivaAcreditable: number; gastoNoDeducible: number } {
  if (p.relacion !== "recibida") return { gastoDeducible: 0, ivaAcreditable: 0, gastoNoDeducible: 0 };
  let deducible = 0;
  let iva = 0;
  let noDeducible = 0;
  for (const c of p.conceptos) {
    // En centavos, para no acumular errores de redondeo.
    const esDeConcepto = esDeducible(p.marca, c.deducibleCategoria);
    if (esDeConcepto) deducible += Math.round(c.importe * 100);
    else noDeducible += Math.round(c.importe * 100);
    for (const impuesto of c.impuestos) {
      iva += Math.round(ivaAcreditable({ relacion: p.relacion, deducible: esDeConcepto, impuesto }).importe * 100);
    }
  }
  return { gastoDeducible: deducible / 100, ivaAcreditable: iva / 100, gastoNoDeducible: noDeducible / 100 };
}
