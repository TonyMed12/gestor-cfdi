import assert from "node:assert/strict";
import { test } from "node:test";
import { expresionSat, interpretarEstado } from "../src/lib/sat.ts";

const respuesta = (estado) =>
  `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ConsultaResponse xmlns="http://tempuri.org/"><ConsultaResult xmlns:a="http://x">` +
  `<a:CodigoEstatus>S - Comprobante obtenido satisfactoriamente.</a:CodigoEstatus><a:Estado>${estado}</a:Estado></ConsultaResult></ConsultaResponse></s:Body></s:Envelope>`;

test("arma la expresión como el código QR: total con 10 enteros y 6 decimales y 8 caracteres del sello", () => {
  const e = expresionSat({ uuid: "U", rfcEmisor: "AAA010101AAA", rfcReceptor: "BBB010101BBB", total: "9977.96", sello: "abcdefghijklmnopqrst12345678" });
  assert.equal(e, "?id=U&re=AAA010101AAA&rr=BBB010101BBB&tt=0000009977.960000&fe=12345678");
});

test("arma bien totales enteros, con muchos decimales y sin sello", () => {
  const base = { uuid: "U", rfcEmisor: "A", rfcReceptor: "B", sello: null };
  assert.match(expresionSat({ ...base, total: "100" }), /tt=0000000100\.000000$/);
  assert.match(expresionSat({ ...base, total: "1.123456789" }), /tt=0000000001\.123456$/);
  assert.doesNotMatch(expresionSat({ ...base, total: "1" }), /fe=/);
});

test("interpreta los tres estados del SAT", () => {
  assert.equal(interpretarEstado(respuesta("Vigente")), "vigente");
  assert.equal(interpretarEstado(respuesta("Cancelado")), "cancelada");
  assert.equal(interpretarEstado(respuesta("No Encontrado")), "no_encontrada");
});

test("una respuesta rara o vacía no se confunde con un estado", () => {
  assert.equal(interpretarEstado(respuesta("Otra cosa")), null);
  assert.equal(interpretarEstado(""), null);
  assert.equal(interpretarEstado("<html>Error 500</html>"), null);
});
