// C7: el resumen de un conjunto conocido de facturas XML coincide con el resultado calculado a mano.
// Recorre el mismo camino que la app: leer el XML → emitida o recibida → clasificar → deducibilidad → resumen.
// Datos y cálculo a mano: pruebas/conjunto-resumen/LEEME.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { categoriaSugeridaDeClave, elegirCategoria } from "../src/lib/categorias-por-defecto.ts";
import { leerCfdi } from "../src/lib/cfdi.ts";
import { esDeducible } from "../src/lib/deducibilidad.ts";
import { REGLAS_BASE } from "../src/lib/reglas-base-claves.ts";
import { calcularResumen } from "../src/lib/resumen.ts";

const carpeta = new URL("./conjunto-resumen/", import.meta.url);
const leerJson = (nombre) => JSON.parse(readFileSync(new URL(nombre, carpeta), "utf8"));
const manifiesto = leerJson("facturas.json");
const esperado = leerJson("esperado.json");

// Categorías de la lista inicial (10-categorias-iniciales.sql): todas deducibles excepto «Gastos no deducibles».
const deducibleDeCategoria = (nombre) => (nombre ? nombre !== "Gastos no deducibles" : undefined);

// Convierte cada XML en la factura que recibe calcularResumen, como lo hacen la lectura y datos.ts.
function facturasDelConjunto() {
  return manifiesto.facturas.map((m) => {
    const leido = leerCfdi(readFileSync(new URL(`xml/${m.archivo}`, carpeta), "utf8"));
    assert.equal(leido.error, undefined, `${m.archivo}: ${leido.error}`);
    assert.equal(leido.exclusion, null, `${m.archivo}: ${leido.exclusion}`);
    const f = leido.factura;
    const relacion = f.rfc_emisor === manifiesto.cliente.rfc ? "emitida" : "recibida";
    return {
      id: m.archivo,
      tipoComprobante: f.tipo_comprobante,
      relacion,
      moneda: f.moneda,
      estadoRevision: m.estadoRevision,
      estadoSat: m.estadoSat,
      motivoExclusion: null,
      total: Number(f.total),
      conceptos: leido.conceptos.map((c) => {
        const { categoria } = elegirCategoria({
          clave: c.clave_prod_serv,
          relacion,
          manual: manifiesto.clavesAsignadasAMano[c.clave_prod_serv],
          base: REGLAS_BASE[c.clave_prod_serv],
        });
        return {
          importe: Number(c.importe),
          categoria: categoria ?? null,
          deducible: esDeducible(m.deducible, deducibleDeCategoria(categoria)),
          impuestos: c.impuestos.map((i) => ({ ...i, importe: Number(i.importe) })),
        };
      }),
    };
  });
}

test("el conjunto tiene las 11 facturas y todas son CFDI 4.0 válidos que cuadran con su total", () => {
  assert.equal(facturasDelConjunto().length, 11);
});

test("los totales del resumen coinciden con el cálculo a mano", () => {
  assert.deepEqual(calcularResumen(facturasDelConjunto()).totales, esperado.totales);
});

test("cada categoría coincide con el cálculo a mano, en el mismo orden", () => {
  assert.deepEqual(calcularResumen(facturasDelConjunto()).filas, esperado.filas);
});

test("las facturas fuera del resumen y su motivo coinciden, y la cuenta cuadra con el total", () => {
  const r = calcularResumen(facturasDelConjunto());
  assert.equal(r.incluidas, esperado.incluidas);
  assert.deepEqual(Object.fromEntries(r.excluidas.map((e) => [e.id, e.motivo])), esperado.excluidas);
  assert.equal(r.incluidas + r.excluidas.length, manifiesto.facturas.length);
  assert.deepEqual(r.ajusteNoDesglosado, esperado.ajusteNoDesglosado);
});

test("la clasificación usada es la esperada (A1, A2): sin la clave asignada a mano, la renta caería en honorarios", () => {
  assert.equal(categoriaSugeridaDeClave("80131502"), "Honorarios y servicios profesionales");
  const renta = facturasDelConjunto().find((f) => f.id === "04-renta-persona-fisica.xml");
  assert.equal(renta.conceptos[0].categoria, "Renta de local o equipo");
});
