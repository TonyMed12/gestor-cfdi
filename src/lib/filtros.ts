// Filtros generales de la bandeja (B2, RF-08): cliente, periodo, emisor, receptor, tipo de comprobante,
// estado ante el SAT y monto, con orden. Viven en la URL para combinarse, paginarse y compartirse.
// Sin dependencias, para probarlos solos (pruebas/filtros.test.mjs).

export const TIPOS_COMPROBANTE = ["I", "E", "T", "P", "N"] as const;
export const ESTADOS_SAT = ["vigente", "cancelada", "no_encontrada", "sin_consultar"] as const;
export const ORDENES = ["prioridad", "fecha_desc", "fecha_asc", "monto_desc", "monto_asc"] as const;

export type Orden = (typeof ORDENES)[number];

export type FiltrosBandeja = {
  cliente?: string; // id del cliente
  periodo?: string; // AAAA-MM
  emisor?: string; // RFC completo o parte, en mayúsculas
  receptor?: string;
  tipo?: (typeof TIPOS_COMPROBANTE)[number];
  estadoSat?: (typeof ESTADOS_SAT)[number];
  montoMin?: number;
  montoMax?: number;
  orden: Orden;
};

export type Parametros = Partial<Record<"cliente" | "periodo" | "emisor" | "receptor" | "tipo" | "sat" | "min" | "max" | "orden", string>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// Un RFC (o parte) solo tiene letras, dígitos, & y Ñ. Cualquier otro carácter se descarta,
// así nada raro llega al filtro de la consulta.
const limpiarRfc = (texto?: string): string | undefined => {
  const limpio = (texto ?? "").toUpperCase().replace(/[^A-Z0-9&Ñ]/g, "").slice(0, 13);
  return limpio.length > 0 ? limpio : undefined;
};

const leerMonto = (texto?: string): number | undefined | "invalido" => {
  const limpio = (texto ?? "").replace(/[\s,$]/g, "");
  if (limpio === "") return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "invalido";
};

// Lee los filtros de la URL. Lo que no es válido se ignora y se informa en `avisos`.
export function leerFiltros(p: Parametros): { filtros: FiltrosBandeja; avisos: string[] } {
  const avisos: string[] = [];
  const filtros: FiltrosBandeja = { orden: "prioridad" };

  if (p.cliente) {
    if (UUID.test(p.cliente)) filtros.cliente = p.cliente;
    else avisos.push("El cliente elegido no es válido.");
  }
  if (p.periodo) {
    if (MES.test(p.periodo)) filtros.periodo = p.periodo;
    else avisos.push("El periodo debe tener el formato AAAA-MM.");
  }
  filtros.emisor = limpiarRfc(p.emisor);
  filtros.receptor = limpiarRfc(p.receptor);
  if (p.tipo && (TIPOS_COMPROBANTE as readonly string[]).includes(p.tipo)) filtros.tipo = p.tipo as FiltrosBandeja["tipo"];
  if (p.sat && (ESTADOS_SAT as readonly string[]).includes(p.sat)) filtros.estadoSat = p.sat as FiltrosBandeja["estadoSat"];
  if (p.orden && (ORDENES as readonly string[]).includes(p.orden)) filtros.orden = p.orden as Orden;

  const min = leerMonto(p.min);
  const max = leerMonto(p.max);
  if (min === "invalido" || max === "invalido") avisos.push("El monto debe ser un número positivo, por ejemplo 1500.50.");
  if (typeof min === "number") filtros.montoMin = min;
  if (typeof max === "number") filtros.montoMax = max;
  if (filtros.montoMin !== undefined && filtros.montoMax !== undefined && filtros.montoMin > filtros.montoMax) {
    avisos.push("El monto mínimo es mayor que el máximo: se intercambiaron.");
    [filtros.montoMin, filtros.montoMax] = [filtros.montoMax, filtros.montoMin];
  }
  return { filtros, avisos };
}

// Los filtros como parámetros de URL (sin vacíos), para los enlaces de paginación y del tipo de comprobante.
export function aParametros(f: FiltrosBandeja): Record<string, string | undefined> {
  return {
    cliente: f.cliente,
    periodo: f.periodo,
    emisor: f.emisor,
    receptor: f.receptor,
    tipo: f.tipo,
    sat: f.estadoSat,
    min: f.montoMin?.toString(),
    max: f.montoMax?.toString(),
    orden: f.orden === "prioridad" ? undefined : f.orden,
  };
}

// ¿Hay algún filtro activo (además del orden)?
export const hayFiltros = (f: FiltrosBandeja): boolean =>
  Boolean(f.cliente || f.periodo || f.emisor || f.receptor || f.tipo || f.estadoSat) ||
  f.montoMin !== undefined || f.montoMax !== undefined;

type Ordenable = { id: string; alta: boolean; fecha: string; total: number };

// Ordena la bandeja. "prioridad" (la de siempre): las de prioridad alta primero y, dentro de cada grupo, las más
// recientes. Los demás órdenes desempatan por id para que la paginación sea estable.
export function ordenarBandeja<T extends Ordenable>(filas: T[], orden: Orden): T[] {
  const porFecha = (a: T, b: T) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id);
  const copia = [...filas];
  switch (orden) {
    case "fecha_desc": return copia.sort(porFecha);
    case "fecha_asc": return copia.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
    case "monto_desc": return copia.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
    case "monto_asc": return copia.sort((a, b) => a.total - b.total || a.id.localeCompare(b.id));
    default: return copia.sort((a, b) => Number(b.alta) - Number(a.alta) || porFecha(a, b));
  }
}
