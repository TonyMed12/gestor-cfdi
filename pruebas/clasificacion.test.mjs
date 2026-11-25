import assert from "node:assert/strict";
import { test } from "node:test";
import { categoriaDeIngresoDeClave, elegirCategoria } from "../src/lib/categorias-por-defecto.ts";

test("en recibidas se respeta el orden: a mano, emisor, regla base y división", () => {
  const base = { clave: "80141629", relacion: "recibida" };
  assert.deepEqual(
    elegirCategoria({ ...base, manual: "Compras de mercancía o insumos", deEmisor: "Seguros", base: "Gastos de oficina y papelería" }),
    { categoria: "Compras de mercancía o insumos", origen: "regla" },
  );
  assert.deepEqual(elegirCategoria({ ...base, deEmisor: "Seguros", base: "Gastos de oficina y papelería" }), { categoria: "Seguros", origen: "emisor" });
  assert.deepEqual(elegirCategoria({ ...base, base: "Gastos de oficina y papelería" }), { categoria: "Gastos de oficina y papelería", origen: "base" });
  assert.deepEqual(elegirCategoria(base), { categoria: "Honorarios y servicios profesionales", origen: "division" });
});

test("una recibida sin regla ni división conocida queda sin clasificar", () => {
  assert.deepEqual(elegirCategoria({ clave: "01010101", relacion: "recibida" }), {});
});

test("una emitida nunca toma una categoría de gasto", () => {
  // Caso real: 86141501 (asesoría educativa) asignada a mano como honorarios, en una factura emitida.
  assert.deepEqual(
    elegirCategoria({ clave: "86141501", relacion: "emitida", manual: "Honorarios y servicios profesionales" }),
    { categoria: "Servicios prestados", origen: "division" },
  );
  assert.deepEqual(
    elegirCategoria({ clave: "14111507", relacion: "emitida", base: "Gastos de oficina y papelería" }),
    { categoria: "Ventas de bienes", origen: "division" },
  );
});

test("una emitida sí toma una categoría de ingreso asignada a mano o por emisor", () => {
  assert.deepEqual(
    elegirCategoria({ clave: "86141501", relacion: "emitida", manual: "Otros ingresos" }),
    { categoria: "Otros ingresos", origen: "regla" },
  );
  assert.deepEqual(
    elegirCategoria({ clave: "50403200", relacion: "emitida", deEmisor: "Ventas de bienes" }),
    { categoria: "Ventas de bienes", origen: "emisor" },
  );
});

test("una recibida nunca toma una categoría de ingreso", () => {
  assert.deepEqual(
    elegirCategoria({ clave: "50403200", relacion: "recibida", manual: "Ventas de bienes" }),
    { categoria: "Compras de mercancía o insumos", origen: "division" },
  );
});

test("el ingreso sugerido distingue servicios (segmentos 70 a 94) de bienes", () => {
  assert.equal(categoriaDeIngresoDeClave("86141501"), "Servicios prestados");
  assert.equal(categoriaDeIngresoDeClave("70101500"), "Servicios prestados");
  assert.equal(categoriaDeIngresoDeClave("94101500"), "Servicios prestados");
  assert.equal(categoriaDeIngresoDeClave("95101500"), "Ventas de bienes");
  assert.equal(categoriaDeIngresoDeClave("50403200"), "Ventas de bienes");
});
