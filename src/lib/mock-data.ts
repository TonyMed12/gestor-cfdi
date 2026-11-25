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

export function getResumenPeriodo(clienteId: string) {
  const delCliente = getFacturasPorCliente(clienteId);
  const incluidas = delCliente.filter(
    (f) => f.estadoRevision === "clasificado",
  );
  const excluidas = delCliente.filter((f) => f.estadoRevision === "excluido");

  const porCategoria = new Map<
    string,
    { ingresos: number; gastos: number; ivaTrasladado: number; ivaAcreditable: number }
  >();

  for (const f of incluidas) {
    const cat = f.categoriaPropuesta;
    const iva = f.conceptos
      .flatMap((c) => c.impuestos)
      .filter((i) => i.impuesto === "IVA" && i.tipo === "trasladado")
      .reduce((sum, i) => sum + i.importe, 0);
    const actual =
      porCategoria.get(cat) ?? {
        ingresos: 0,
        gastos: 0,
        ivaTrasladado: 0,
        ivaAcreditable: 0,
      };
    if (f.relacion === "emitida") {
      actual.ingresos += f.total;
      actual.ivaTrasladado += iva;
    } else {
      actual.gastos += f.total;
      actual.ivaAcreditable += iva;
    }
    porCategoria.set(cat, actual);
  }

  return {
    porCategoria: Array.from(porCategoria.entries()).map(([categoria, v]) => ({
      categoria,
      ...v,
    })),
    excluidas: excluidas.map((f) => ({
      descripcion: `${f.emisorNombre} · $${f.total.toLocaleString("es-MX")}`,
      motivo: f.motivoExclusion ?? "Sin motivo registrado",
    })),
    totalIncluidas: incluidas.length,
    totalExcluidas: excluidas.length,
  };
}
