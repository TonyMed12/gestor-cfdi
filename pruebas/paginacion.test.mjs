import assert from "node:assert/strict";
import { test } from "node:test";
import { describirPagina, leerPagina, paginaDe, POR_PAGINA, rangoDePagina } from "../src/lib/paginacion.ts";

test("las listas van de 50 en 50", () => {
  assert.equal(POR_PAGINA, 50);
});

test("la página de la URL: solo enteros positivos; lo demás es la página 1", () => {
  assert.equal(leerPagina("3"), 3);
  for (const texto of [undefined, null, "", "0", "-2", "1.5", "abc", "2e3x"]) assert.equal(leerPagina(texto), 1, String(texto));
});

test("el rango de Supabase es inclusivo: la página 1 son las filas 0 a 49", () => {
  assert.deepEqual(rangoDePagina(1), { desde: 0, hasta: 49 });
  assert.deepEqual(rangoDePagina(3), { desde: 100, hasta: 149 });
  assert.deepEqual(rangoDePagina(2, 10), { desde: 10, hasta: 19 });
});

test("la descripción de la página cuadra con el total y se ajusta si la página ya no existe", () => {
  assert.deepEqual(describirPagina(1, 120), { pagina: 1, paginas: 3, total: 120, desde: 1, hasta: 50 });
  assert.deepEqual(describirPagina(3, 120), { pagina: 3, paginas: 3, total: 120, desde: 101, hasta: 120 });
  assert.deepEqual(describirPagina(9, 120), { pagina: 3, paginas: 3, total: 120, desde: 101, hasta: 120 });
  assert.deepEqual(describirPagina(1, 50), { pagina: 1, paginas: 1, total: 50, desde: 1, hasta: 50 });
  assert.deepEqual(describirPagina(2, 0), { pagina: 1, paginas: 1, total: 0, desde: 0, hasta: 0 });
});

test("una página de una lista ya ordenada en memoria", () => {
  const lista = Array.from({ length: 120 }, (_, i) => i + 1);
  assert.deepEqual(paginaDe(lista, 1).slice(0, 2), [1, 2]);
  assert.equal(paginaDe(lista, 1).length, 50);
  assert.deepEqual(paginaDe(lista, 3), lista.slice(100));
  assert.deepEqual(paginaDe(lista, 4), []);
});
