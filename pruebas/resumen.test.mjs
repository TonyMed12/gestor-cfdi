import assert from "node:assert/strict";
import { test } from "node:test";
import { esDeducible } from "../src/lib/deducibilidad.ts";
import { agruparExclusiones, calcularResumen, cuadraConPeriodo, motivoExclusion } from "../src/lib/resumen.ts";

test("las facturas fuera del resumen se agrupan por motivo y el total cuadra con el periodo (C5)", () => {
  const r = calcularResumen([
    factura({ id: "A" }),
    factura({ id: "B", estadoRevision: "por_revisar" }),
    factura({ id: "C", estadoRevision: "por_revisar" }),
    factura({ id: "D", estadoSat: "cancelada" }),
    factura({ id: "E", estadoRevision: "por_confirmar" }),
    factura({ id: "F", estadoRevision: "excluido", motivoExclusion: "Los importes y los impuestos no suman el total" }),
  ]);
  assert.deepEqual(
    agruparExclusiones(r.excluidas).map((g) => [g.motivo, g.facturas.map((x) => x.id)]),
    [
      ["Pendiente de aprobar", ["B", "C"]],
      ["Cancelada ante el SAT", ["D"]],
      ["Excluida: Los importes y los impuestos no suman el total", ["F"]],
      ["Por confirmar", ["E"]],
    ],
  );
  assert.equal(r.incluidas, 1);
  assert.equal(cuadraConPeriodo(r.incluidas, r.excluidas.length, 6), true);
  assert.equal(cuadraConPeriodo(r.incluidas, r.excluidas.length, 7), false);
  assert.deepEqual(agruparExclusiones([]), []);
});

test("la marca por factura (A7) gana sobre la categoría en gastos deducibles e IVA acreditable", () => {
  // Misma factura de papelería (categoría deducible) con las tres marcas posibles, resuelta como en datos.ts.
  const conMarca = (marca) => calcularResumen([factura({
    conceptos: [{ importe: 1000, categoria: "Gastos de oficina y papelería", deducible: esDeducible(marca, true), impuestos: [iva(1000)] }],
  })]).totales;
  assert.deepEqual([conMarca(null).gastosDeducibles, conMarca(null).ivaAcreditable], [1000, 160]); // según la categoría
  assert.deepEqual([conMarca(true).gastosDeducibles, conMarca(true).ivaAcreditable], [1000, 160]);
  assert.deepEqual([conMarca(false).gastosDeducibles, conMarca(false).ivaAcreditable], [0, 0]); // no deducible
  assert.equal(conMarca(false).gastos, 1000); // el gasto sigue contando, solo no se deduce
  // Una categoría no deducible marcada como deducible por el contador sí se deduce.
  const r = calcularResumen([factura({
    conceptos: [{ importe: 500, categoria: "Gastos no deducibles", deducible: esDeducible(true, false), impuestos: [iva(500)] }],
  })]).totales;
  assert.deepEqual([r.gastosDeducibles, r.ivaAcreditable], [500, 80]);
});

// Fábrica de facturas de prueba: aprobada, vigente, de ingreso (I), en pesos. Cada prueba cambia lo que necesita.
const iva = (base, tasa = 0.16) => ({ tipo: "trasladado", impuesto: "IVA", tasa, importe: Math.round(base * tasa * 100) / 100 });
const factura = (cambios = {}) => ({
  id: cambios.id ?? "F",
  tipoComprobante: "I",
  relacion: "recibida",
  moneda: "MXN",
  estadoRevision: "clasificado",
  estadoSat: "vigente",
  motivoExclusion: null,
  total: 1160,
  conceptos: [{ importe: 1000, categoria: "Gastos de oficina y papelería", deducible: true, impuestos: [iva(1000)] }],
  ...cambios,
});

test("una factura recibida suma al gasto, al IVA acreditable y a su categoría", () => {
  const r = calcularResumen([factura()]);
  assert.deepEqual(r.totales, {
    ingresos: 0, gastos: 1000, gastosDeducibles: 1000, ivaTrasladado: 0, ivaAcreditable: 160,
    retencionesAFavor: 0, retencionesPorEnterar: 0,
  });
  assert.deepEqual(r.filas, [{
    tipo: "Gasto", categoria: "Gastos de oficina y papelería", facturas: 1, importe: 1000, gastoDeducible: 1000,
    ivaTrasladado: 160, ivaAcreditable: 160, iepsTrasladado: 0, isrRetenido: 0, ivaRetenido: 0,
  }]);
  assert.equal(r.incluidas, 1);
  assert.deepEqual(r.excluidas, []);
});

test("conjunto conocido: ingresos con retenciones, gastos deducibles y no deducibles, y una nota de crédito", () => {
  // Calculado a mano:
  // Ingresos: 10,000 (servicios) - 1,000 (nota de crédito) = 9,000. IVA trasladado: 1,600 - 160 = 1,440.
  //   Retenciones que le hicieron al cliente: ISR 1,000 (10 %) + IVA 1,066.67 = 2,066.67.
  // Gastos: 10,000 (honorarios) + 2,000 (papelería) + 500 (no deducible) + 300 (tasa 0) = 12,800.
  //   IVA acreditable: 1,600 (honorarios) + 320 (papelería) = 1,920. El no deducible (80) no acredita;
  //   la tasa 0 no tiene IVA.
  //   Retención que hizo el cliente: ISR 125 (1.25 % RESICO de los honorarios).
  const r = calcularResumen([
    factura({
      id: "ING", relacion: "emitida", total: 9533.33,
      conceptos: [{ importe: 10000, categoria: "Servicios prestados", deducible: true, impuestos: [
        iva(10000), { tipo: "retenido", impuesto: "ISR", tasa: 0.1, importe: 1000 },
        { tipo: "retenido", impuesto: "IVA", tasa: 0.106667, importe: 1066.67 },
      ] }],
    }),
    factura({
      id: "NC", relacion: "emitida", tipoComprobante: "E", total: 1160,
      conceptos: [{ importe: 1000, categoria: "Servicios prestados", deducible: true, impuestos: [iva(1000)] }],
    }),
    factura({ id: "PAP", total: 2320, conceptos: [{ importe: 2000, categoria: "Gastos de oficina y papelería", deducible: true, impuestos: [iva(2000)] }] }),
    factura({ id: "ND", total: 580, conceptos: [{ importe: 500, categoria: "Gastos no deducibles", deducible: false, impuestos: [iva(500)] }] }),
    factura({ id: "T0", total: 300, conceptos: [{ importe: 300, categoria: "Compras de mercancía o insumos", deducible: true, impuestos: [iva(300, 0)] }] }),
    factura({
      id: "RES", total: 11475, conceptos: [{ importe: 10000, categoria: "Honorarios y servicios profesionales", deducible: true, impuestos: [
        iva(10000), { tipo: "retenido", impuesto: "ISR", tasa: 0.0125, importe: 125 },
      ] }],
    }),
  ]);
  // Gastos deducibles: 12,800 - 500 (no deducible) = 12,300.
  assert.deepEqual(r.totales, {
    ingresos: 9000, gastos: 12800, gastosDeducibles: 12300, ivaTrasladado: 1440, ivaAcreditable: 1920,
    retencionesAFavor: 2066.67, retencionesPorEnterar: 125,
  });
  assert.deepEqual(r.filas.map((f) => [f.tipo, f.categoria, f.facturas, f.importe]), [
    ["Ingreso", "Servicios prestados", 2, 9000],
    ["Gasto", "Honorarios y servicios profesionales", 1, 10000],
    ["Gasto", "Gastos de oficina y papelería", 1, 2000],
    ["Gasto", "Gastos no deducibles", 1, 500],
    ["Gasto", "Compras de mercancía o insumos", 1, 300],
  ]);
  assert.equal(r.filas.find((f) => f.categoria === "Gastos no deducibles").ivaAcreditable, 0);
  assert.equal(r.incluidas, 6);
  assert.deepEqual(r.ajusteNoDesglosado, { importe: 0, facturas: 0 });
});

test("solo entran las aprobadas, no canceladas, de ingreso o egreso y en pesos (RN-01, RN-05, RN-06)", () => {
  const casos = [
    [{ estadoRevision: "excluido", motivoExclusion: "Los conceptos no suman el subtotal" }, "Excluida: Los conceptos no suman el subtotal"],
    [{ estadoSat: "cancelada" }, "Cancelada ante el SAT"],
    [{ estadoRevision: "por_confirmar" }, "Por confirmar"],
    [{ estadoRevision: "por_revisar" }, "Pendiente de aprobar"],
    [{ tipoComprobante: "P" }, "Comprobante de pago: el importe ya está en la factura que paga"],
    [{ tipoComprobante: "N" }, "Recibo de nómina: aún no se incluye en el resumen"],
    [{ moneda: "USD" }, "En USD: falta el tipo de cambio"],
  ];
  for (const [cambios, motivo] of casos) assert.equal(motivoExclusion(factura(cambios)), motivo, motivo);
  assert.equal(motivoExclusion(factura()), null);
  assert.equal(motivoExclusion(factura({ estadoSat: null })), null); // sin consultar al SAT: entra
  // Una cancelada no entra aunque esté aprobada.
  const r = calcularResumen([factura({ id: "A" }), factura({ id: "B", estadoSat: "cancelada" })]);
  assert.equal(r.totales.gastos, 1000);
  assert.deepEqual(r.excluidas, [{ id: "B", motivo: "Cancelada ante el SAT" }]);
  assert.equal(r.incluidas + r.excluidas.length, 2);
});

test("la diferencia con el total (retención local o descuento) se informa aparte", () => {
  // Caso real: asesoría de 8,849.63 con IVA, ISR 1.25 % y retención cedular de 176.99 que no se guarda por concepto.
  const r = calcularResumen([factura({
    relacion: "emitida", total: 9977.96,
    conceptos: [{ importe: 8849.63, categoria: "Servicios prestados", deducible: true, impuestos: [
      { tipo: "trasladado", impuesto: "IVA", tasa: 0.16, importe: 1415.94 },
      { tipo: "retenido", impuesto: "ISR", tasa: 0.0125, importe: 110.62 },
    ] }],
  })]);
  assert.deepEqual(r.ajusteNoDesglosado, { importe: -176.99, facturas: 1 });
  assert.equal(r.totales.ingresos, 8849.63);
});

test("las sumas en centavos no acumulan errores de redondeo", () => {
  const muchas = Array.from({ length: 10 }, (_, i) => factura({ id: `F${i}`, total: 0.116, conceptos: [
    { importe: 0.1, categoria: "Gastos de oficina y papelería", deducible: true, impuestos: [] },
  ] }));
  assert.equal(calcularResumen(muchas).totales.gastos, 1);
});
