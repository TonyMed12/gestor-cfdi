import assert from "node:assert/strict";
import { test } from "node:test";
import { deduccionesDeFactura, esDeducible } from "../src/lib/deducibilidad.ts";

test("la marca de la factura gana sobre la de la categoría", () => {
  assert.equal(esDeducible(null, true), true);
  assert.equal(esDeducible(null, false), false);
  assert.equal(esDeducible(true, false), true);
  assert.equal(esDeducible(false, true), false);
  assert.equal(esDeducible(undefined, undefined), true); // sin datos: deducible, como deducible_default
});

const conceptos = [
  { importe: 1000, impuestos: [{ tipo: "trasladado", impuesto: "IVA", tasa: 0.16, importe: 160 }], deducibleCategoria: true }, // papelería
  { importe: 500, impuestos: [{ tipo: "trasladado", impuesto: "IVA", tasa: 0.16, importe: 80 }], deducibleCategoria: false }, // gastos no deducibles
];

test("según la categoría: solo el concepto de categoría deducible cuenta", () => {
  assert.deepEqual(deduccionesDeFactura({ relacion: "recibida", marca: null, conceptos }), {
    gastoDeducible: 1000, ivaAcreditable: 160, gastoNoDeducible: 500,
  });
});

test("factura marcada como deducible: todos sus conceptos cuentan", () => {
  assert.deepEqual(deduccionesDeFactura({ relacion: "recibida", marca: true, conceptos }), {
    gastoDeducible: 1500, ivaAcreditable: 240, gastoNoDeducible: 0,
  });
});

test("factura marcada como no deducible: nada se deduce ni se acredita", () => {
  assert.deepEqual(deduccionesDeFactura({ relacion: "recibida", marca: false, conceptos }), {
    gastoDeducible: 0, ivaAcreditable: 0, gastoNoDeducible: 1500,
  });
});

test("una factura emitida es ingreso: no tiene deducciones ni IVA acreditable", () => {
  assert.deepEqual(deduccionesDeFactura({ relacion: "emitida", marca: null, conceptos }), {
    gastoDeducible: 0, ivaAcreditable: 0, gastoNoDeducible: 0,
  });
});

test("caso real: gasolina de 346.19 con IVA de 53.81, deducible por su categoría", () => {
  assert.deepEqual(
    deduccionesDeFactura({ relacion: "recibida", marca: null, conceptos: [{ importe: 346.19, impuestos: [{ tipo: "trasladado", impuesto: "IVA", tasa: 0.16, importe: 53.81 }], deducibleCategoria: true }] }),
    { gastoDeducible: 346.19, ivaAcreditable: 53.81, gastoNoDeducible: 0 },
  );
});
