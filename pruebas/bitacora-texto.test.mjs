import assert from "node:assert/strict";
import { test } from "node:test";
import { clientesEnDetalles, describirDetalle } from "../src/lib/bitacora-texto.ts";

const AGRO = "be62f925-31cc-4246-8f06-4f61802cfdac";
const nombres = new Map([[AGRO, "AGRO CONCENTRADORA ALCANTAR"]]);

test("D6: cada exportación se lee en palabras: periodo, cliente, formato y facturas", () => {
  const detalle = { formato: "xlsx", cliente_id: AGRO, mes_anio: "2026-10", estado_periodo: "abierto", facturas: 12, incluidas: 2 };
  assert.equal(describirDetalle("exporto", detalle, nombres), "Resumen de octubre 2026 de AGRO CONCENTRADORA ALCANTAR en Excel (12 facturas)");
  assert.equal(describirDetalle("exporto", { ...detalle, formato: "pdf", estado_periodo: "cerrado", facturas: 1 }, nombres),
    "Resumen de octubre 2026 de AGRO CONCENTRADORA ALCANTAR en PDF (1 factura, periodo cerrado)");
  assert.equal(describirDetalle("exporto", { ...detalle, formato: "csv" }), "Resumen de octubre 2026 en CSV (12 facturas)"); // sin nombre
});

test("D6: el cierre de periodo se lee en palabras", () => {
  const detalle = { cliente_id: AGRO, mes_anio: "2026-01", periodo_id: "x", facturas: 1 };
  assert.equal(describirDetalle("cerro_periodo", detalle, nombres), "Enero 2026 de AGRO CONCENTRADORA ALCANTAR · 1 factura");
});

test("D6: un cambio en periodo cerrado muestra su motivo (D4)", () => {
  const detalle = { conceptos_corregidos: 0, motivo_periodo_cerrado: "Llegó tarde la factura", periodo_cerrado: "2026-10" };
  assert.equal(describirDetalle("aprobo", detalle), "Periodo cerrado (octubre 2026) · Motivo: Llegó tarde la factura");
});

test("D6: las demás acciones se muestran como antes", () => {
  assert.equal(describirDetalle("aprobo", { conceptos_corregidos: 0 }), null);
  assert.equal(describirDetalle("subio", { archivo: "x.xml" }), null);
  assert.equal(describirDetalle("exporto", null), null);
});

test("D6: ids de clientes de los detalles, sin repetir ni valores raros", () => {
  assert.deepEqual(clientesEnDetalles([{ cliente_id: AGRO }, { cliente_id: AGRO }, { cliente_id: "x,y" }, null, {}]), [AGRO]);
});
