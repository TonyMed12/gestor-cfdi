import assert from "node:assert/strict";
import { test } from "node:test";
import { describirPagina, leerPagina, paginaDe, POR_PAGINA, rangoDePagina } from "../src/lib/paginacion.ts";

test("las listas van de 10 en 10", () => {
  assert.equal(POR_PAGINA, 10);
});

test("la página de la URL: solo enteros positivos; lo demás es la página 1", () => {
  assert.equal(leerPagina("3"), 3);
  for (const texto of [undefined, null, "", "0", "-2", "1.5", "abc", "2e3x"]) assert.equal(leerPagina(texto), 1, String(texto));
});

test("el rango de Supabase es inclusivo: la página 1 son las filas 0 a 9", () => {
  assert.deepEqual(rangoDePagina(1), { desde: 0, hasta: 9 });
  assert.deepEqual(rangoDePagina(3), { desde: 20, hasta: 29 });
  assert.deepEqual(rangoDePagina(2, 50), { desde: 50, hasta: 99 });
});

test("la descripción de la página cuadra con el total y se ajusta si la página ya no existe", () => {
  assert.deepEqual(describirPagina(1, 25), { pagina: 1, paginas: 3, total: 25, desde: 1, hasta: 10 });
  assert.deepEqual(describirPagina(3, 25), { pagina: 3, paginas: 3, total: 25, desde: 21, hasta: 25 });
  assert.deepEqual(describirPagina(9, 25), { pagina: 3, paginas: 3, total: 25, desde: 21, hasta: 25 });
  assert.deepEqual(describirPagina(1, 10), { pagina: 1, paginas: 1, total: 10, desde: 1, hasta: 10 });
  assert.deepEqual(describirPagina(2, 0), { pagina: 1, paginas: 1, total: 0, desde: 0, hasta: 0 });
});

test("una página de una lista ya ordenada en memoria", () => {
  const lista = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.deepEqual(paginaDe(lista, 1).slice(0, 2), [1, 2]);
  assert.equal(paginaDe(lista, 1).length, 10);
  assert.deepEqual(paginaDe(lista, 3), lista.slice(20));
  assert.deepEqual(paginaDe(lista, 4), []);
});
