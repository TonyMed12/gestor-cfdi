import assert from "node:assert/strict";
import { test } from "node:test";
import { describirDetalle } from "../src/lib/bitacora-texto.ts";
import { ENCABEZADO_BITACORA, csvBitacora, nombreCsvBitacora } from "../src/lib/exportar-bitacora.ts";

const AGRO = "be62f925-31cc-4246-8f06-4f61802cfdac";
const registros = [
  {
    ocurrido_en: "2026-11-26T03:17:08.123+00:00", // 25 nov 2026, 21:17 en el centro de México
    accion: "exporto",
    detalle: { formato: "xlsx", cliente_id: AGRO, mes_anio: "2026-10", estado_periodo: "abierto", facturas: 12 },
    usuario: { nombre: "Tony Medina" },
    factura: null,
  },
  {
    ocurrido_en: "2026-11-25T15:20:49Z",
    accion: "corrigio",
    detalle: { conceptos_corregidos: 1 },
    usuario: { nombre: "Tony Medina" },
    factura: { uuid_fiscal: "FBFD25EE-CC94-491F-8784-3CF35C1EE8EA", nombre_emisor: "CESAR VICENTE MARTINEZ GONZALEZ" },
  },
  {
    ocurrido_en: "2026-11-20T18:00:00Z",
    accion: "subio",
    detalle: { archivo: "=cmd|' /C calc'!A0.xml", resultado: "Leído" }, // nombre de archivo malicioso
    usuario: null,
    factura: null,
  },
];
const lineas = (csv) => csv.slice(1).trimEnd().split("\r\n");

test("D7: el CSV tiene fecha, usuario, acción, factura y detalle, una fila por registro", () => {
  const csv = csvBitacora(registros, new Map([[AGRO, "AGRO CONCENTRADORA ALCANTAR"]]));
  assert.equal(csv.charCodeAt(0), 0xfeff); // BOM: Excel lee bien los acentos
  const [encabezado, ...filas] = lineas(csv);
  assert.equal(encabezado, ENCABEZADO_BITACORA.join(","));
  assert.equal(filas.length, 3);
  assert.equal(filas[0], "2026-11-25 21:17:08,Tony Medina,Exportó,,,Resumen de octubre 2026 de AGRO CONCENTRADORA ALCANTAR en Excel (12 facturas)");
  assert.equal(
    filas[1],
    `2026-11-25 09:20:49,Tony Medina,Corrigió o rechazó,CESAR VICENTE MARTINEZ GONZALEZ,FBFD25EE-CC94-491F-8784-3CF35C1EE8EA,"{""conceptos_corregidos"":1}"`,
  );
});

test("D7: un texto que Excel tomaría como fórmula se neutraliza", () => {
  const fila = lineas(csvBitacora(registros))[3];
  assert.ok(fila.startsWith("2026-11-20 12:00:00,,Subió un archivo,,,"));
  assert.ok(!fila.includes(',"=cmd') && !fila.includes(",=cmd"));
  // El detalle va como JSON entre comillas; empieza con «{», no con «=».
  assert.ok(fila.endsWith(`"{""archivo"":""=cmd|' /C calc'!A0.xml"",""resultado"":""Leído""}"`));
});

test("D7: descargar la bitácora también queda en ella, en palabras", () => {
  assert.equal(describirDetalle("exporto", { tipo: "bitacora", formato: "csv", registros: 91 }), "Bitácora en CSV (91 registros)");
  assert.equal(describirDetalle("exporto", { tipo: "bitacora", formato: "csv", registros: 1 }), "Bitácora en CSV (1 registro)");
});

test("D7: bitácora vacía y nombre del archivo", () => {
  assert.equal(lineas(csvBitacora([])).length, 1); // solo el encabezado
  assert.equal(nombreCsvBitacora(new Date("2026-11-26T03:00:00Z")), "bitacora-2026-11-25.csv"); // día en México
});
