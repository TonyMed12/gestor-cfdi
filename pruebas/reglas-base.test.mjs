import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { esCategoriaDeIngreso } from "../src/lib/categorias-por-defecto.ts";
import { REGLAS_BASE } from "../src/lib/reglas-base-claves.ts";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const fuente = JSON.parse(leer("../scripts/categorias-claves-propuestas.json"));
// Nombres de la lista inicial de categorías (10-categorias-iniciales.sql).
const iniciales = new Set([...leer("../supabase/10-categorias-iniciales.sql").matchAll(/\('([^']+)',\s*(?:true|false)\)/g)].map((m) => m[1]));

test("reglas-base-claves.ts coincide con el JSON (se genera con scripts/generar-reglas-base.mjs)", () => {
  assert.deepEqual(REGLAS_BASE, Object.fromEntries(fuente.map((r) => [r.clave, r.categoria])));
});

test("cada regla usa una categoría de gasto que existe en la lista inicial", () => {
  assert.equal(iniciales.size, 15);
  for (const [clave, categoria] of Object.entries(REGLAS_BASE)) {
    assert.ok(iniciales.has(categoria), `${clave}: «${categoria}» no está en 10-categorias-iniciales.sql`);
    assert.equal(esCategoriaDeIngreso(categoria), false, `${clave}: «${categoria}» es de ingreso`);
  }
});

test("las correcciones de la revisión A2 traen su motivo", () => {
  const revisadas = fuente.filter((r) => r.origen === "revisión A2");
  assert.equal(revisadas.length, 35);
  for (const r of revisadas) {
    assert.ok(r.motivo && r.categoria_anterior, r.clave);
    assert.notEqual(r.categoria, r.categoria_anterior, r.clave);
  }
});

test("casos corregidos: el papel industrial, de empaque o de laboratorio no es papelería", () => {
  assert.equal(REGLAS_BASE["14121504"], "Compras de mercancía o insumos"); // papel de empaque
  assert.equal(REGLAS_BASE["14122107"], "Compras de mercancía o insumos"); // papel base corrugado
  assert.equal(REGLAS_BASE["48102108"], "Compras de mercancía o insumos"); // papel aluminio para alimentos
  assert.equal(REGLAS_BASE["81112500"], "Equipo de cómputo y software"); // arrendamiento de licencias
  assert.equal(REGLAS_BASE["90111504"], "Combustible, viáticos y transporte"); // alquiler de cabañas
  assert.equal(REGLAS_BASE["14111507"], "Gastos de oficina y papelería"); // papel para impresora: se queda
});

test("las claves sin categoría que encaje ya no tienen regla", () => {
  for (const clave of ["14111601", "14111704", "27112153", "42203705", "52152201", "76122400"]) {
    assert.equal(REGLAS_BASE[clave], undefined, clave);
  }
});
