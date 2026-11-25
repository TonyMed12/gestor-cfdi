import assert from "node:assert/strict";
import { test } from "node:test";
import { esMesAnio, mesDeFecha, nombreMes } from "../src/lib/formato.ts";

test("el periodo de una fecha usa la hora del centro de México, como 20-periodos.sql", () => {
  assert.equal(mesDeFecha("2026-02-01T02:00:00+00:00"), "2026-01"); // 31 de enero, 20:00 en México
  assert.equal(mesDeFecha("2026-02-01T06:00:00+00:00"), "2026-02"); // 1 de febrero, 00:00 en México
  assert.equal(mesDeFecha("2026-10-15T18:00:00+00:00"), "2026-10");
});

test("el nombre del periodo es el mes en español y el año", () => {
  assert.equal(nombreMes("2026-10"), "octubre 2026");
  assert.equal(nombreMes("2026-01"), "enero 2026");
  assert.equal(nombreMes("2025-12"), "diciembre 2025");
});

test("solo acepta periodos AAAA-MM válidos", () => {
  assert.equal(esMesAnio("2026-10"), true);
  for (const texto of ["2026-13", "2026-00", "2026-1", "26-10", "2026-10-01", "octubre", ""]) {
    assert.equal(esMesAnio(texto), false, texto);
  }
  assert.equal(nombreMes("2026-13"), "2026-13");
});
