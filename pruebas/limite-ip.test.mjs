import assert from "node:assert/strict";
import { test } from "node:test";
import { bloqueoPorIp, ipDeLaPeticion, MAX_FALLOS_POR_IP, mensajeBloqueoIp, MINUTOS_VENTANA_IP } from "../src/lib/limite-ip.ts";

const encabezados = (h) => ({ get: (n) => h[n] ?? null });
const AHORA = new Date("2026-11-25T20:00:00Z");
const haceMinutos = (m) => new Date(AHORA.getTime() - m * 60_000);

test("G6: 10 intentos fallidos en 15 minutos desde la misma conexión", () => {
  assert.equal(MAX_FALLOS_POR_IP, 10);
  assert.equal(MINUTOS_VENTANA_IP, 15);
});

test("G6: con repeticiones, el intento 11 se bloquea; antes no", () => {
  const fallos = [];
  for (let i = 1; i <= MAX_FALLOS_POR_IP; i++) {
    // Antes de registrar el fallo número i, la conexión aún puede intentar.
    assert.deepEqual(bloqueoPorIp(fallos, AHORA), { bloqueada: false }, `intento ${i}`);
    fallos.push(haceMinutos(MAX_FALLOS_POR_IP - i)); // uno por minuto
  }
  const r = bloqueoPorIp(fallos, AHORA);
  assert.equal(r.bloqueada, true);
  // El más antiguo de los 10 fue hace 9 minutos: se libera en 6.
  assert.equal(r.minutos, 6);
});

test("G6: el bloqueo se levanta cuando los fallos salen de la ventana de 15 minutos", () => {
  const viejos = Array.from({ length: 10 }, (_, i) => haceMinutos(16 + i));
  assert.deepEqual(bloqueoPorIp(viejos, AHORA), { bloqueada: false });
  // 9 recientes y 1 viejo: todavía puede intentar una vez más.
  const mezcla = [...Array.from({ length: 9 }, (_, i) => haceMinutos(i)), haceMinutos(20)];
  assert.deepEqual(bloqueoPorIp(mezcla, AHORA), { bloqueada: false });
  // 10 en el mismo minuto: espera los 15 completos.
  assert.deepEqual(bloqueoPorIp(Array.from({ length: 10 }, () => AHORA), AHORA), { bloqueada: true, minutos: 15 });
  // Más de 10 (por ejemplo, de antes del límite): cuenta desde el décimo más reciente.
  const once = Array.from({ length: 11 }, (_, i) => haceMinutos(i));
  assert.deepEqual(bloqueoPorIp(once, AHORA), { bloqueada: true, minutos: 6 });
});

test("G6: la IP de la petición: la primera de x-forwarded-for, luego x-real-ip; lo raro no cuenta como IP", () => {
  assert.equal(ipDeLaPeticion(encabezados({ "x-forwarded-for": "201.141.10.5, 10.0.0.1" })), "201.141.10.5");
  assert.equal(ipDeLaPeticion(encabezados({ "x-real-ip": "::1" })), "::1");
  assert.equal(ipDeLaPeticion(encabezados({ "x-forwarded-for": "2806:2F0:9000::A" })), "2806:2f0:9000::a");
  assert.equal(ipDeLaPeticion(encabezados({})), "desconocida");
  assert.equal(ipDeLaPeticion(encabezados({ "x-forwarded-for": "<script>, 1.1.1.1" })), "desconocida");
});

test("G6: el mensaje dice cuánto esperar", () => {
  assert.equal(mensajeBloqueoIp(1), "Demasiados intentos desde esta conexión. Espera 1 minuto y vuelve a intentar.");
  assert.equal(mensajeBloqueoIp(6), "Demasiados intentos desde esta conexión. Espera 6 minutos y vuelve a intentar.");
});
