import assert from "node:assert/strict";
import { test } from "node:test";
import { esDeducible } from "../src/lib/deducibilidad.ts";
import { ivaAcreditable } from "../src/lib/iva.ts";
import { calcularResumen } from "../src/lib/resumen.ts";

const IVA = (tasa, importe, cambios = {}) => ({ tipo: "trasladado", impuesto: "IVA", tasa, importe, ...cambios });
const regla = (cambios) => ivaAcreditable({ relacion: "recibida", deducible: true, impuesto: IVA(0.16, 160), ...cambios });

test("IVA al 16 % de un gasto deducible: se acredita completo", () => {
  assert.deepEqual(regla({}), { importe: 160, motivo: null });
});

test("IVA al 8 % (región fronteriza): también se acredita", () => {
  assert.deepEqual(regla({ impuesto: IVA(0.08, 80) }), { importe: 80, motivo: null });
});

test("exento: no genera IVA acreditable", () => {
  assert.deepEqual(regla({ impuesto: IVA(0, 0, { factor: "Exento" }) }), { importe: 0, motivo: "Exento: no genera IVA acreditable" });
});

test("tasa cero: no genera IVA acreditable", () => {
  assert.deepEqual(regla({ impuesto: IVA(0, 0) }), { importe: 0, motivo: "Tasa 0 %: no genera IVA acreditable" });
});

test("gasto no deducible: su IVA no se acredita", () => {
  assert.deepEqual(regla({ deducible: false }), { importe: 0, motivo: "Gasto no deducible" });
});

test("factura emitida: su IVA es trasladado, nunca acreditable", () => {
  assert.deepEqual(regla({ relacion: "emitida" }), { importe: 0, motivo: "Factura emitida: su IVA es trasladado, no acreditable" });
});

test("una tasa que no está vigente no se acredita", () => {
  assert.deepEqual(regla({ impuesto: IVA(0.11, 110) }), { importe: 0, motivo: "Tasa de IVA no válida (11 %)" });
  assert.deepEqual(regla({ impuesto: IVA(0.15, 150) }), { importe: 0, motivo: "Tasa de IVA no válida (15 %)" });
});

test("solo el IVA trasladado: ni el retenido ni el IEPS se acreditan aquí", () => {
  assert.equal(regla({ impuesto: { tipo: "retenido", impuesto: "IVA", tasa: 0.106667, importe: 106.67 } }).importe, 0);
  assert.equal(regla({ impuesto: { tipo: "trasladado", impuesto: "IEPS", tasa: 0.08, importe: 8 } }).importe, 0);
});

test("en el resumen: solo suma el IVA que la regla acepta, con la marca por factura (A7)", () => {
  const f = (id, cambios) => ({
    id, tipoComprobante: "I", relacion: "recibida", moneda: "MXN", estadoRevision: "clasificado", estadoSat: "vigente",
    motivoExclusion: null, total: 0, ...cambios,
  });
  const concepto = (importe, deducible, impuestos) => ({ importe, categoria: "Gastos de oficina y papelería", deducible, impuestos });
  // A mano: 160 (16 %) + 40 (8 % de 500) - 16 (nota de crédito al 16 % de 100) = 184.
  // No suman: 80 (factura marcada no deducible en categoría deducible), tasa 0, exento y 110 (tasa 11 % no vigente).
  const r = calcularResumen([
    f("A", { total: 1160, conceptos: [concepto(1000, esDeducible(null, true), [IVA(0.16, 160)])] }),
    f("B", { total: 540, conceptos: [concepto(500, esDeducible(true, true), [IVA(0.08, 40)])] }),
    f("C", { total: 116, tipoComprobante: "E", conceptos: [concepto(100, true, [IVA(0.16, 16)])] }),
    f("D", { total: 580, conceptos: [concepto(500, esDeducible(false, true), [IVA(0.16, 80)])] }),
    f("E", { total: 300, conceptos: [concepto(300, true, [IVA(0, 0)])] }),
    f("F", { total: 200, conceptos: [concepto(200, true, [IVA(0, 0, { factor: "Exento" })])] }),
    f("G", { total: 1110, conceptos: [concepto(1000, true, [IVA(0.11, 110)])] }),
  ]);
  assert.equal(r.totales.ivaAcreditable, 184);
  assert.equal(r.filas.find((x) => x.categoria === "Gastos de oficina y papelería").ivaTrasladado, 160 + 40 - 16 + 80 + 110);
});
