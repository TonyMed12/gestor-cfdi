import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretarBusquedaUuid } from "../src/lib/busqueda.ts";

const UUID = "88149FA2-699C-43F1-9DAF-6F782A75A1F9";

test("un UUID completo se busca exacto, sin importar mayúsculas ni espacios", () => {
  assert.deepEqual(interpretarBusquedaUuid(UUID), { tipo: "completo", uuid: UUID });
  assert.deepEqual(interpretarBusquedaUuid(`  ${UUID.toLowerCase()} `), { tipo: "completo", uuid: UUID });
});

test("un fragmento se busca como parte del folio, en mayúsculas", () => {
  assert.deepEqual(interpretarBusquedaUuid("88149fa2"), { tipo: "fragmento", fragmento: "88149FA2" });
  assert.deepEqual(interpretarBusquedaUuid("6F782A75A1F9"), { tipo: "fragmento", fragmento: "6F782A75A1F9" });
  assert.deepEqual(interpretarBusquedaUuid("699c-43f1"), { tipo: "fragmento", fragmento: "699C-43F1" });
});

test("sin texto no hay búsqueda", () => {
  assert.deepEqual(interpretarBusquedaUuid(""), { tipo: "vacia" });
  assert.deepEqual(interpretarBusquedaUuid("   "), { tipo: "vacia" });
  assert.deepEqual(interpretarBusquedaUuid(undefined), { tipo: "vacia" });
});

test("un fragmento demasiado corto se rechaza con su motivo", () => {
  const r = interpretarBusquedaUuid("88-1");
  assert.equal(r.tipo, "invalida");
  assert.match(r.error, /al menos 4 caracteres/);
});

test("caracteres que no pueden estar en un folio se rechazan (y no llegan a la consulta)", () => {
  for (const texto of ["XYZ12345", "8814%", "88149FA2,id.eq.1", "ACEVEDO"]) {
    const r = interpretarBusquedaUuid(texto);
    assert.equal(r.tipo, "invalida", texto);
    assert.match(r.error, /números, letras de la A a la F y guiones/);
  }
});
