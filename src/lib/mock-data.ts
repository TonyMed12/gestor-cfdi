// Datos de ejemplo para las pantallas que aún no usan la base de datos
// (facturas, revisión y resumen). Se reemplazarán conforme existan las tablas.

import type { Cliente, Factura } from "./types";

// Mes en curso, por ejemplo "noviembre 2026". Se reemplazará por los periodos reales de la base.
export const getPeriodoActual = () =>
  new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  })
    .format(new Date())
    .replace(" de ", " ");

export const clientes: Cliente[] = [];
export const facturas: Factura[] = [];

export function getClientePorId(id: string) {
  return clientes.find((c) => c.id === id);
}

export function getFacturaPorId(id: string) {
  return facturas.find((f) => f.id === id);
}

export function getFacturasPorCliente(clienteId: string) {
  return facturas.filter((f) => f.clienteId === clienteId);
}

export function getFacturasPorRevisar() {
  return facturas
    .filter((f) => f.estadoRevision === "por_revisar")
    .sort((a, b) => (a.prioridad === b.prioridad ? 0 : a.prioridad === "alta" ? -1 : 1));
}

export function getTotalPorRevisar() {
  return getFacturasPorRevisar().length;
}

// El resumen del periodo ya usa datos reales: getResumenPeriodo en datos.ts (C3).
