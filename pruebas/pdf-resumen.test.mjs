import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularResumen } from "../src/lib/resumen.ts";
import { MAXIMO_POR_MOTIVO, nombrePdf, pdfResumen } from "../src/lib/pdf-resumen.ts";

const iva = (base, tasa = 0.16) => ({ tipo: "trasladado", impuesto: "IVA", tasa, importe: Math.round(base * tasa * 100) / 100 });
let n = 0;
const factura = (cambios = {}) => ({
  id: `F${++n}`,
  uuid: `AAAAAAAA-0000-0000-0000-${String(n).padStart(12, "0")}`,
  fecha: "2026-10-15T12:00:00+00:00",
  tipoComprobante: "I",
  relacion: "recibida",
  moneda: "MXN",
  estadoRevision: "clasificado",
  estadoSat: "vigente",
  motivoExclusion: null,
  total: 1160,
  rfcEmisor: "AAA010101AAA",
  nombreEmisor: "Papelería Ñandú",
  rfcReceptor: "BBB010101BBB",
  nombreReceptor: "Cliente",
  conceptos: [{ descripcion: "Hojas", importe: 1000, categoria: "Gastos de oficina y papelería", deducible: true, impuestos: [iva(1000)] }],
  ...cambios,
});

const datos = (facturas, cambios = {}) => ({
  cliente: { razonSocial: "José Antonio Medina", rfc: "MEZA6906197G4" },
  periodo: { mesAnio: "2026-10", nombre: "octubre 2026", estado: "abierto" },
  resumen: calcularResumen(facturas),
  facturas,
  generado: new Date("2026-11-01T18:00:00Z"),
  ...cambios,
});

// Lee el PDF como lo haría un visor: número de hojas y el texto de cada una.
async function leerPdf(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false, verbosity: 0 }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const contenido = await (await doc.getPage(i)).getTextContent();
    paginas.push(contenido.items.map((x) => x.str).join(" ").replace(/\s+/g, " "));
  }
  const info = (await doc.getMetadata()).info;
  return { paginas, texto: paginas.join(" "), titulo: info.Title };
}

const normales = () => [
  factura(),
  factura({ total: 580, conceptos: [{ descripcion: "Gasolina", importe: 500, categoria: "Combustible", deducible: true, impuestos: [iva(500)] }] }),
  factura({ relacion: "emitida", total: 11600, nombreReceptor: "Gobierno del Estado", conceptos: [{ descripcion: "Asesoría", importe: 10000, categoria: "Servicios prestados", deducible: true, impuestos: [iva(10000)] }] }),
  factura({ tipoComprobante: "E", total: 116, conceptos: [{ descripcion: "Devolución", importe: 100, categoria: "Gastos de oficina y papelería", deducible: true, impuestos: [iva(100)] }] }),
  factura({ estadoRevision: "por_revisar", nombreEmisor: "Pendiente SA" }),
  factura({ estadoSat: "cancelada", nombreEmisor: "Cancelada SA" }),
];

test("D3: el PDF trae el encabezado del cliente y del periodo, los totales, las categorías y las excluidas", async () => {
  const d = datos(normales());
  const { paginas, texto, titulo } = await leerPdf(await pdfResumen(d));
  assert.equal(paginas.length, 1);
  assert.equal(titulo, "Resumen del periodo octubre 2026 · José Antonio Medina");
  for (const esperado of [
    "Resumen del periodo · Octubre 2026", "José Antonio Medina", "RFC MEZA6906197G4", "Periodo abierto",
    "6 facturas en el periodo = 4 incluidas + 2 fuera del resumen",
    // Totales del resumen, con formato de pesos.
    "Ingresos", "$10,000.00", "Gastos", "$1,400.00", "IVA acreditable", "$224.00",
    // Por categoría, separando ingresos y gastos, con subtotales.
    "Por categoría", "Ingresos", "Servicios prestados", "Total ingresos", "Gastos", "Gastos de oficina y papelería",
    "Combustible", "Total gastos",
    // Excluidas con su motivo y sus facturas.
    "Fuera del resumen · 2 de 6", "Pendiente de aprobar · 1 factura", "Pendiente SA", "Cancelada ante el SAT · 1 factura",
    "Cancelada SA", "Página 1 de 1",
  ]) {
    assert.ok(texto.includes(esperado), `falta «${esperado}»`);
  }
  const t = d.resumen.totales;
  assert.equal(t.gastos, 1400);
  assert.equal(t.ivaAcreditable, 224);
});

test("D3: los subtotales de cada grupo son los totales del resumen", async () => {
  const d = datos(normales());
  const { texto } = await leerPdf(await pdfResumen(d));
  const pesos = (v) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  // «Total gastos» seguido del importe y el deducible de los gastos.
  assert.ok(texto.includes(`Total gastos ${pesos(d.resumen.totales.gastos)} ${pesos(d.resumen.totales.gastosDeducibles)}`), texto);
  assert.ok(texto.includes(`Total ingresos ${pesos(d.resumen.totales.ingresos)} —`));
});

test("D3: un periodo cerrado dice cuándo y quién lo cerró", async () => {
  const d = datos(normales(), {
    periodo: { mesAnio: "2026-10", nombre: "octubre 2026", estado: "cerrado" },
    cierre: "Periodo cerrado el 25 nov 2026 por Tony Medina.",
  });
  const { texto } = await leerPdf(await pdfResumen(d));
  assert.ok(texto.includes("Periodo cerrado el 25 nov 2026 por Tony Medina."));
});

test("D3: con muchas facturas fuera del resumen sigue en dos hojas como máximo", async () => {
  // 15 categorías de gasto y 60 facturas pendientes: la lista se recorta con aviso.
  const muchas = [
    ...Array.from({ length: 15 }, (_, i) =>
      factura({ conceptos: [{ descripcion: "X", importe: 1000 + i, categoria: `Categoría de gasto número ${i + 1}`, deducible: true, impuestos: [iva(1000 + i)] }] })),
    ...Array.from({ length: 60 }, () => factura({ estadoRevision: "por_revisar" })),
    ...Array.from({ length: 12 }, () => factura({ estadoSat: "cancelada" })),
  ];
  const { paginas, texto } = await leerPdf(await pdfResumen(datos(muchas)));
  assert.ok(paginas.length <= 2, `salieron ${paginas.length} hojas`);
  assert.ok(texto.includes(`… y ${60 - MAXIMO_POR_MOTIVO} más`));
  assert.ok(texto.includes(`… y ${12 - MAXIMO_POR_MOTIVO} más`));
  assert.ok(texto.includes(`Página ${paginas.length} de ${paginas.length}`));
});

test("D3: textos raros de terceros no rompen el PDF", async () => {
  const raras = [factura({ nombreEmisor: "Ñandú «Cía» – 😀 中文 & <x>", estadoRevision: "por_revisar" }), factura()];
  const { texto } = await leerPdf(await pdfResumen(datos(raras)));
  assert.ok(texto.includes("Ñandú «Cía» – ? ?? & <x>"), texto);
});

test("D3: periodo sin facturas aprobadas", async () => {
  const { texto } = await leerPdf(await pdfResumen(datos([factura({ estadoRevision: "por_revisar" })])));
  assert.ok(texto.includes("Aún no hay facturas aprobadas en este periodo."));
});

test("D3: nombre del archivo", () => {
  assert.equal(nombrePdf("MEZA6906197G4", "2026-10"), "resumen-MEZA6906197G4-2026-10.pdf");
  assert.equal(nombrePdf('A&Ñ"\r\n1', "2026-10"), "resumen-A1-2026-10.pdf");
});
