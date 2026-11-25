// Deducibilidad por factura (A7). Sin dependencias, para poder probarla sola (pruebas/deducibilidad.test.mjs).
// La usará también el resumen del periodo (C3) cuando se rehaga.

// Marca de la factura: null = según la categoría de cada concepto; true o false = decisión del contador.
export type MarcaDeducible = boolean | null;

// ¿Un concepto es deducible? La marca de la factura gana sobre la de su categoría.
// Sin marca ni categoría conocida se toma como deducible, igual que deducible_default en la base.
export const esDeducible = (marcaFactura: MarcaDeducible | undefined, deducibleCategoria: boolean | undefined): boolean =>
  marcaFactura ?? deducibleCategoria ?? true;

export type ConceptoDeducible = {
  importe: number;
  ivaTrasladado: number; // IVA trasladado del concepto
  deducibleCategoria: boolean | undefined;
};

// Gasto deducible e IVA acreditable de una factura según su deducibilidad.
// Una factura emitida es un ingreso: no tiene gasto deducible ni IVA acreditable.
// Solo cuenta la deducibilidad; las reglas de tasa del IVA acreditable son la tarea C4.
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
    if (esDeducible(p.marca, c.deducibleCategoria)) {
      deducible += Math.round(c.importe * 100);
      iva += Math.round(c.ivaTrasladado * 100);
    } else {
      noDeducible += Math.round(c.importe * 100);
    }
  }
  return { gastoDeducible: deducible / 100, ivaAcreditable: iva / 100, gastoNoDeducible: noDeducible / 100 };
}
