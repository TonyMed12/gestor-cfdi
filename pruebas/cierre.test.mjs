import assert from "node:assert/strict";
import { test } from "node:test";
import { describirCierre, leerMotivoCierre, mensajeErrorCierre, puedeCerrar } from "../src/lib/cierre.ts";

test("D4: el motivo de un cambio en periodo cerrado es obligatorio, de 5 a 300 caracteres", () => {
  assert.ok("error" in leerMotivoCierre(undefined));
  assert.ok("error" in leerMotivoCierre(""));
  assert.ok("error" in leerMotivoCierre("   ok   ")); // 2 letras
  assert.ok("error" in leerMotivoCierre("x".repeat(301)));
  assert.deepEqual(leerMotivoCierre("  Llegó   tarde\nla factura  "), { motivo: "Llegó tarde la factura" });
  assert.deepEqual(leerMotivoCierre("12345"), { motivo: "12345" });
});

test("D4: solo se cierra sin facturas por revisar ni por confirmar", () => {
  assert.deepEqual(puedeCerrar({ porRevisar: 0, porConfirmar: 0 }), { ok: true });
  const una = puedeCerrar({ porRevisar: 1, porConfirmar: 0 });
  assert.equal(una.ok, false);
  assert.match(una.motivo, /Falta 1 factura/);
  const varias = puedeCerrar({ porRevisar: 7, porConfirmar: 2 });
  assert.match(varias.motivo, /Faltan 9 facturas/);
});

test("D4: los errores de la base se traducen; los demás no", () => {
  assert.match(mensajeErrorCierre({ code: "PC001" }), /periodo cerrado/);
  assert.equal(mensajeErrorCierre({ code: "PC002", message: "El periodo tiene 3 factura(s) por revisar" }), "El periodo tiene 3 factura(s) por revisar");
  assert.match(mensajeErrorCierre({ code: "PC003" }), /no se puede reabrir/);
  assert.equal(mensajeErrorCierre({ code: "23505" }), undefined);
  assert.equal(mensajeErrorCierre(null), undefined);
});

test("D4: cuándo y quién cerró, en palabras", () => {
  assert.equal(describirCierre(null, null), "Periodo cerrado.");
  assert.equal(describirCierre(null, "Tony Medina"), "Periodo cerrado por Tony Medina.");
  // 2026-11-26 02:30 UTC = 25 nov 2026, 8:30 p.m. en el centro de México.
  const texto = describirCierre("2026-11-26T02:30:00Z", "Tony Medina");
  assert.match(texto, /^Periodo cerrado el 25 nov 2026/);
  assert.match(texto, /por Tony Medina\.$/);
});
