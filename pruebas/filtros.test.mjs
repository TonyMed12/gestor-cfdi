import assert from "node:assert/strict";
import { test } from "node:test";
import { aParametros, hayFiltros, leerFiltros, ordenarBandeja } from "../src/lib/filtros.ts";

const CLIENTE = "be62f925-31cc-4246-8f06-4f61802cfdac";

test("sin parámetros no hay filtros y el orden es por prioridad", () => {
  const { filtros, avisos } = leerFiltros({});
  assert.deepEqual(filtros, { orden: "prioridad", emisor: undefined, receptor: undefined });
  assert.deepEqual(avisos, []);
  assert.equal(hayFiltros(filtros), false);
});

test("lee y combina todos los filtros", () => {
  const { filtros, avisos } = leerFiltros({
    cliente: CLIENTE, periodo: "2026-10", emisor: "comm92", receptor: "aca161103fs5", tipo: "I",
    sat: "vigente", min: "1,000.50", max: "$20000", orden: "monto_desc",
  });
  assert.deepEqual(avisos, []);
  assert.deepEqual(filtros, {
    cliente: CLIENTE, periodo: "2026-10", emisor: "COMM92", receptor: "ACA161103FS5", tipo: "I",
    estadoSat: "vigente", montoMin: 1000.5, montoMax: 20000, orden: "monto_desc",
  });
  assert.equal(hayFiltros(filtros), true);
});

test("lo que no es válido se ignora y se avisa", () => {
  const { filtros, avisos } = leerFiltros({ cliente: "abc", periodo: "2026-13", tipo: "Z", sat: "otro", min: "-5", orden: "x" });
  assert.deepEqual(filtros, { orden: "prioridad", emisor: undefined, receptor: undefined });
  assert.equal(avisos.length, 3);
});

test("el RFC del receptor solo conserva letras, dígitos, & y Ñ: nada raro llega a la consulta", () => {
  assert.equal(leerFiltros({ receptor: "ab%c,d.e*(f)" }).filtros.receptor, "ABCDEF");
  assert.equal(leerFiltros({ receptor: "%%%" }).filtros.receptor, undefined);
  assert.equal(leerFiltros({ receptor: "ñañ&01" }).filtros.receptor, "ÑAÑ&01");
});

test("B3: el emisor acepta RFC o nombre, en mayúsculas o minúsculas", () => {
  assert.equal(leerFiltros({ emisor: "roth840308hua" }).filtros.emisor, "ROTH840308HUA");
  assert.equal(leerFiltros({ emisor: "hugo rojas" }).filtros.emisor, "HUGO ROJAS");
  assert.equal(leerFiltros({ emisor: "Hugo Rojas" }).filtros.emisor, leerFiltros({ emisor: "HUGO ROJAS" }).filtros.emisor);
  assert.equal(leerFiltros({ emisor: "  j.  gregorio  " }).filtros.emisor, "J. GREGORIO"); // espacios de más
  assert.equal(leerFiltros({ emisor: "Martínez" }).filtros.emisor, "MARTÍNEZ"); // acentos
  assert.equal(leerFiltros({ emisor: "ñ & co-op" }).filtros.emisor, "Ñ & CO-OP");
});

test("B3: del nombre del emisor se descarta lo que podría alterar la consulta", () => {
  // % y _ son comodines de la búsqueda; comas, paréntesis y comillas romperían el filtro de Supabase.
  assert.equal(leerFiltros({ emisor: 'hugo%_rojas,(x)"' }).filtros.emisor, "HUGOROJASX");
  assert.equal(leerFiltros({ emisor: "nombre_emisor.eq.x" }).filtros.emisor, "NOMBREEMISOR.EQ.X");
  assert.equal(leerFiltros({ emisor: "%,()" }).filtros.emisor, undefined);
  assert.ok(leerFiltros({ emisor: "x".repeat(200) }).filtros.emisor.length <= 80);
});

test("si el mínimo es mayor que el máximo, se intercambian con aviso", () => {
  const { filtros, avisos } = leerFiltros({ min: "500", max: "100" });
  assert.deepEqual([filtros.montoMin, filtros.montoMax], [100, 500]);
  assert.equal(avisos.length, 1);
});

test("los filtros vuelven a la URL sin vacíos (para paginar y cambiar de tipo sin perderlos)", () => {
  const { filtros } = leerFiltros({ cliente: CLIENTE, min: "100", orden: "fecha_asc" });
  assert.deepEqual(Object.fromEntries(Object.entries(aParametros(filtros)).filter(([, v]) => v)), {
    cliente: CLIENTE, min: "100", orden: "fecha_asc",
  });
  assert.equal(aParametros(leerFiltros({}).filtros).orden, undefined); // prioridad no se escribe
});

test("ordenar la bandeja: prioridad (la de siempre), fecha y monto", () => {
  const filas = [
    { id: "a", alta: false, fecha: "2026-10-05", total: 300 },
    { id: "b", alta: true, fecha: "2026-10-01", total: 100 },
    { id: "c", alta: false, fecha: "2026-10-09", total: 200 },
    { id: "d", alta: true, fecha: "2026-10-07", total: 100 },
  ];
  const ids = (orden) => ordenarBandeja(filas, orden).map((f) => f.id).join("");
  assert.equal(ids("prioridad"), "dbca"); // altas primero, cada grupo de la más reciente a la más antigua
  assert.equal(ids("fecha_desc"), "cdab");
  assert.equal(ids("fecha_asc"), "badc");
  assert.equal(ids("monto_desc"), "acbd"); // empates de monto por id
  assert.equal(ids("monto_asc"), "bdca");
});
