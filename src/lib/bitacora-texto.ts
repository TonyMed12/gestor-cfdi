// Detalle de la bitácora en palabras (D6). Para exportaciones y cierres de periodo, y para los cambios en un periodo
// cerrado (D4); lo demás se muestra como antes. Sin dependencias, para probarlo solo (pruebas/bitacora-texto.test.mjs).

// Nombre de cada acción, para la pantalla y la exportación (D7).
export const ACCIONES: Record<string, string> = {
  subio: "Subió un archivo",
  aprobo: "Aprobó la clasificación",
  corrigio: "Corrigió o rechazó",
  exporto: "Exportó",
  cerro_periodo: "Cerró un periodo",
};

const FORMATOS: Record<string, string> = { csv: "CSV", xlsx: "Excel", pdf: "PDF" };

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const mes = (mesAnio: unknown) => {
  const m = typeof mesAnio === "string" ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mesAnio) : null;
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : "un periodo";
};
const facturas = (n: unknown) => (typeof n === "number" ? (n === 1 ? "1 factura" : `${n} facturas`) : null);

// `clientes`: id → razón social, para mostrar el nombre en lugar del id.
export function describirDetalle(
  accion: string,
  detalle: Record<string, unknown> | null,
  clientes: Map<string, string> = new Map(),
): string | null {
  if (!detalle) return null;
  const cliente = typeof detalle.cliente_id === "string" ? clientes.get(detalle.cliente_id) : undefined;
  const de = cliente ? ` de ${cliente}` : "";

  // D7: la bitácora también registra cuando se descarga a sí misma.
  if (accion === "exporto" && detalle.tipo === "bitacora") {
    const n = typeof detalle.registros === "number" ? detalle.registros : null;
    return `Bitácora en CSV${n === null ? "" : n === 1 ? " (1 registro)" : ` (${n} registros)`}`;
  }
  if (accion === "exporto" && typeof detalle.formato === "string") {
    const formato = FORMATOS[detalle.formato] ?? detalle.formato;
    const cuantas = facturas(detalle.facturas);
    const estado = detalle.estado_periodo === "cerrado" ? ", periodo cerrado" : "";
    return `Resumen de ${mes(detalle.mes_anio)}${de} en ${formato}${cuantas ? ` (${cuantas}${estado})` : ""}`;
  }
  if (accion === "cerro_periodo") {
    const cuantas = facturas(detalle.facturas);
    return `${mes(detalle.mes_anio).replace(/^./, (c) => c.toUpperCase())}${de}${cuantas ? ` · ${cuantas}` : ""}`;
  }
  if (typeof detalle.motivo_periodo_cerrado === "string") {
    return `Periodo cerrado (${mes(detalle.periodo_cerrado)}) · Motivo: ${detalle.motivo_periodo_cerrado}`;
  }
  return null; // se muestra como siempre
}

// Ids de clientes que aparecen en los detalles, para buscar sus nombres de una vez.
export const clientesEnDetalles = (detalles: (Record<string, unknown> | null)[]): string[] => [
  ...new Set(
    detalles.flatMap((d) =>
      typeof d?.cliente_id === "string" && /^[0-9a-f-]{36}$/i.test(d.cliente_id) ? [d.cliente_id] : [],
    ),
  ),
];
