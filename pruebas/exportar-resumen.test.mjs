import assert from "node:assert/strict";
import { test } from "node:test";
import { XMLValidator } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import { calcularResumen } from "../src/lib/resumen.ts";
import { ENCABEZADO_DETALLE, aCsv, filasCsv, libroResumen, nombreArchivo } from "../src/lib/exportar-resumen.ts";
import { columna } from "../src/lib/xlsx.ts";

const iva = (base, tasa = 0.16) => ({ tipo: "trasladado", impuesto: "IVA", tasa, importe: Math.round(base * tasa * 100) / 100 });
const retencion = (impuesto, importe) => ({ tipo: "retenido", impuesto, tasa: 0, importe });
const factura = (cambios = {}) => ({
  id: "F",
  uuid: "AAAAAAAA-0000-0000-0000-000000000000",
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

const facturas = [
  factura({ id: "A" }),
  factura({
    id: "B", total: 1050, nombreEmisor: "=HYPERLINK(\"x\") & <Cía>",
    conceptos: [
      { descripcion: "Gasolina, magna", importe: 500, categoria: "Combustible", deducible: true, impuestos: [iva(500)] },
      { descripcion: "Comida", importe: 400, categoria: "Gastos no deducibles", deducible: false, impuestos: [iva(400)] },
    ],
  }),
  factura({ id: "C", tipoComprobante: "E", total: 116, conceptos: [{ descripcion: "Devolución", importe: 100, categoria: "Gastos de oficina y papelería", deducible: true, impuestos: [iva(100)] }] }),
  factura({
    id: "D", relacion: "emitida", total: 10600,
    conceptos: [{ descripcion: "Asesoría", importe: 10000, categoria: "Servicios prestados", deducible: true, impuestos: [iva(10000), retencion("ISR", 1000), retencion("IVA", 1066.67)] }],
  }),
  factura({ id: "E", estadoRevision: "por_revisar" }),
  factura({ id: "G", estadoSat: "cancelada" }),
];

const datos = () => ({
  cliente: { razonSocial: "José Antonio", rfc: "JOSA800101XX1" },
  periodo: { mesAnio: "2026-10", nombre: "octubre 2026", estado: "abierto" },
  resumen: calcularResumen(facturas),
  facturas,
  generado: new Date("2026-11-01T18:00:00Z"),
});
const col = (nombre) => ENCABEZADO_DETALLE.indexOf(nombre);

// ---------- CSV (D1) ----------

test("D1: el CSV es una sola tabla: encabezado, una fila por factura y el total de las incluidas", () => {
  const filas = filasCsv(datos());
  assert.deepEqual(filas[0], ENCABEZADO_DETALLE);
  assert.equal(filas.length, 1 + facturas.length + 1);
  assert.ok(filas.every((f) => f.length === ENCABEZADO_DETALLE.length), "todas las filas tienen las mismas columnas");
  const porFactura = filas.slice(1, -1);
  assert.deepEqual(porFactura.map((f) => f[col("En el resumen")]), ["Sí", "Sí", "Sí", "Sí", "No", "No"]);
  assert.deepEqual(porFactura.slice(4).map((f) => f[col("Motivo")]), ["Pendiente de aprobar", "Cancelada ante el SAT"]);
  assert.equal(porFactura[4][col("Importe")], undefined); // las de fuera no aportan cifras
  assert.equal(porFactura[1][col("Categorías")], "Combustible; Gastos no deducibles");
  assert.equal(porFactura[1][col("Conceptos")], "Gasolina, magna [Combustible] 500.00 | Comida [Gastos no deducibles] 400.00");
  assert.equal(porFactura[2][col("Tipo de comprobante")], "E (Egreso, nota de crédito)");
  assert.equal(porFactura[3][col("Ingreso o gasto")], "Ingreso"); // la emitida
  assert.equal(porFactura[0][col("Fecha de emisión")], "2026-10-15");
});

test("D1: las cifras del CSV cuadran con el resumen", () => {
  const d = datos();
  const filas = filasCsv(d);
  const incluidas = filas.slice(1, -1).filter((f) => f[col("En el resumen")] === "Sí");
  const suma = (campo, tipo) =>
    incluidas.filter((f) => !tipo || f[col("Ingreso o gasto")] === tipo).reduce((s, f) => s + Math.round(f[col(campo)] * 100), 0) / 100;
  const t = d.resumen.totales;
  assert.equal(suma("Importe", "Ingreso"), t.ingresos);
  assert.equal(suma("Importe", "Gasto"), t.gastos);
  assert.equal(suma("Gasto deducible"), t.gastosDeducibles);
  assert.equal(suma("IVA trasladado", "Ingreso"), t.ivaTrasladado);
  assert.equal(suma("IVA acreditable"), t.ivaAcreditable);
  assert.equal(suma("ISR retenido", "Ingreso") + suma("IVA retenido", "Ingreso"), t.retencionesAFavor);
  assert.equal(incluidas[2][col("Importe")], -100); // la nota de crédito resta
  const total = filas.at(-1);
  assert.equal(total[0], "Total de las incluidas");
  assert.equal(total[col("Importe")], suma("Importe"));
  assert.equal(total[col("IVA acreditable")], t.ivaAcreditable);
});

test("D1: CSV para Excel: BOM, acentos, comillas, CRLF y números con punto", () => {
  const csv = aCsv([["Categoría", "Gasolina, magna", 'Dice "hola"', 1234.5, -16, null], ["Ñandú"]]);
  assert.equal(csv.charCodeAt(0), 0xfeff); // BOM: Excel lee los acentos como UTF-8
  assert.equal(csv.slice(1), 'Categoría,"Gasolina, magna","Dice ""hola""",1234.50,-16.00,\r\nÑandú\r\n');
});

test("D1: un texto que Excel tomaría como fórmula se neutraliza en el CSV", () => {
  const csv = aCsv([["=HYPERLINK(\"x\")", "+1", "-resta", "@SUM(A1)", "normal"]]);
  assert.equal(csv.slice(1), `"'=HYPERLINK(""x"")",'+1,'-resta,'@SUM(A1),normal\r\n`);
  assert.ok(aCsv(filasCsv(datos())).includes(`"'=HYPERLINK(""x"") & <Cía>"`));
});

test("D1 y D2: nombre del archivo seguro para la descarga", () => {
  assert.equal(nombreArchivo("JOSA800101XX1", "2026-10"), "resumen-JOSA800101XX1-2026-10.csv");
  assert.equal(nombreArchivo("JOSA800101XX1", "2026-10", "xlsx"), "resumen-JOSA800101XX1-2026-10.xlsx");
  assert.equal(nombreArchivo('A&Ñ"\r\n1', "2026-10"), "resumen-A1-2026-10.csv");
});

// ---------- Excel (D2) ----------

// Abre el .xlsx (un ZIP) y lee sus hojas como tablas: celda → { valor, estilo, formula }.
function abrirLibro(bytes) {
  const zip = unzipSync(bytes);
  const archivo = (ruta) => strFromU8(zip[ruta]);
  const leerHoja = (ruta) => {
    const celdas = {};
    for (const m of archivo(ruta).matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>(.*?)<\/c>)/g)) {
      const [, ref, attrs, cuerpo = ""] = m;
      const texto = cuerpo.match(/<t[^>]*>(.*?)<\/t>/)?.[1];
      const v = cuerpo.match(/<v>(.*?)<\/v>/)?.[1];
      celdas[ref] = {
        valor: texto !== undefined ? texto : v !== undefined ? Number(v) : null,
        estilo: Number(attrs.match(/s="(\d+)"/)?.[1] ?? 0),
        formula: cuerpo.match(/<f>(.*?)<\/f>/)?.[1],
      };
    }
    return celdas;
  };
  return { zip, archivo, leerHoja };
}

test("D2: el libro tiene las partes de un .xlsx válido y las hojas Resumen y Detalle", () => {
  const { zip, archivo } = abrirLibro(libroResumen(datos()));
  for (const parte of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
    assert.ok(zip[parte], `falta ${parte}`);
  }
  // Cada parte es XML bien formado (si no, Excel dice que el archivo está dañado).
  for (const parte of Object.keys(zip)) {
    const resultado = XMLValidator.validate(archivo(parte));
    assert.equal(resultado, true, `${parte}: ${JSON.stringify(resultado)}`);
  }
  assert.deepEqual([...archivo("xl/workbook.xml").matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]), ["Resumen", "Detalle"]);
  // Cada estilo usado existe en styles.xml.
  const estilos = Number(archivo("xl/styles.xml").match(/<cellXfs count="(\d+)"/)[1]);
  for (const h of ["sheet1", "sheet2"]) {
    for (const m of archivo(`xl/worksheets/${h}.xml`).matchAll(/ s="(\d+)"/g)) assert.ok(Number(m[1]) < estilos);
  }
  // Detalle: encabezado fijo y con filtros.
  const detalle = archivo("xl/worksheets/sheet2.xml");
  assert.match(detalle, /<pane ySplit="1" topLeftCell="A2"[^>]*state="frozen"\/>/);
  assert.match(detalle, new RegExp(`<autoFilter ref="A1:${columna(ENCABEZADO_DETALLE.length - 1)}${facturas.length + 1}"/>`));
});

test("D2: los totales de la hoja Resumen son los del resumen", () => {
  const d = datos();
  const resumen = abrirLibro(libroResumen(d)).leerHoja("xl/worksheets/sheet1.xml");
  const porEtiqueta = (etiqueta) => {
    const ref = Object.keys(resumen).find((r) => r.startsWith("A") && resumen[r].valor === etiqueta);
    return resumen[`B${ref.slice(1)}`].valor;
  };
  const t = d.resumen.totales;
  assert.equal(porEtiqueta("Ingresos"), t.ingresos);
  assert.equal(porEtiqueta("Gastos"), t.gastos);
  assert.equal(porEtiqueta("Gastos deducibles"), t.gastosDeducibles);
  assert.equal(porEtiqueta("IVA trasladado"), t.ivaTrasladado);
  assert.equal(porEtiqueta("IVA acreditable"), t.ivaAcreditable);
  assert.equal(porEtiqueta("Retenciones a favor"), t.retencionesAFavor);
  assert.equal(porEtiqueta("Retenciones por enterar"), t.retencionesPorEnterar);
  // Por categoría: cada fila del resumen, con su importe.
  for (const f of d.resumen.filas) {
    const ref = Object.keys(resumen).find((r) => r.startsWith("B") && resumen[r].valor === f.categoria && resumen[`A${r.slice(1)}`]?.valor === f.tipo);
    assert.ok(ref, `falta ${f.tipo} ${f.categoria}`);
    assert.equal(resumen[`D${ref.slice(1)}`].valor, f.importe);
  }
  // Fuera del resumen, por motivo.
  assert.ok(Object.values(resumen).some((c) => c.valor === "Fuera del resumen · 2 de 6"));
});

test("D2: la hoja Detalle tiene una fila por factura y el total con fórmula SUMA que cuadra", () => {
  const d = datos();
  const detalle = abrirLibro(libroResumen(d)).leerHoja("xl/worksheets/sheet2.xml");
  const ultima = facturas.length + 2; // encabezado + facturas + total
  assert.equal(detalle[`A${ultima}`].valor, "Total de las incluidas");
  const importe = columna(col("Importe"));
  assert.equal(detalle[`${importe}${ultima}`].formula, `SUM(${importe}2:${importe}${ultima - 1})`);
  // El valor calculado de la fórmula es la suma de las celdas de arriba (las de fuera están vacías).
  for (const campo of ["Importe", "Gasto deducible", "IVA acreditable", "ISR retenido"]) {
    const c = columna(col(campo));
    let suma = 0;
    for (let r = 2; r < ultima; r++) suma += Math.round((detalle[`${c}${r}`]?.valor ?? 0) * 100);
    assert.equal(detalle[`${c}${ultima}`].valor, suma / 100, campo);
  }
  const t = d.resumen.totales;
  assert.equal(detalle[`${columna(col("IVA acreditable"))}${ultima}`].valor, t.ivaAcreditable);
  assert.equal(detalle[`${columna(col("Gasto deducible"))}${ultima}`].valor, t.gastosDeducibles);
  // La fecha va como fecha de Excel (15/10/2026) y las de fuera del resumen en gris.
  assert.equal(detalle[`${columna(col("Fecha de emisión"))}2`].valor, 46310);
  assert.notEqual(detalle["A6"].estilo, detalle["A2"].estilo);
});

test("D2: los textos de terceros se guardan como texto, con & < > escapados", () => {
  const { archivo } = abrirLibro(libroResumen(datos()));
  const detalle = archivo("xl/worksheets/sheet2.xml");
  assert.ok(detalle.includes(`<t xml:space="preserve">=HYPERLINK(&quot;x&quot;) &amp; &lt;Cía&gt;</t>`));
  assert.ok(!/<f>HYPERLINK/.test(detalle)); // nunca como fórmula
  assert.ok(detalle.includes("Papelería Ñandú")); // acentos en UTF-8
});

test("D2: columnas de Excel", () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52].map(columna), ["A", "Z", "AA", "AB", "AZ", "BA"]);
});
