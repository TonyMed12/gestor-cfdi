// Importe con su moneda, por ejemplo "$3,016.00". Si la moneda no es un código válido
// (por ejemplo, una factura guardada antes de validarla), muestra el número y la clave
// en lugar de lanzar un error que rompería la página.
export function dinero(total: string, moneda: string) {
  try {
    return Number(total).toLocaleString("es-MX", { style: "currency", currency: moneda });
  } catch {
    return `${Number(total).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
  }
}

// Periodo mensual en formato AAAA-MM, como se guarda en periodo.mes_anio (C1).
export const esMesAnio = (texto: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Periodo (AAAA-MM) de una fecha de emisión guardada en la base. Igual que mes_de_periodo en
// supabase/20-periodos.sql: la fecha del CFDI se guarda como hora del centro de México (-06:00).
export function mesDeFecha(iso: string): string {
  return new Date(new Date(iso).getTime() - 6 * 3600 * 1000).toISOString().slice(0, 7);
}

// "2026-10" → "octubre 2026". Sin Date, para que la zona horaria no cambie el mes.
export function nombreMes(mesAnio: string): string {
  if (!esMesAnio(mesAnio)) return mesAnio;
  const [anio, mes] = mesAnio.split("-");
  return `${MESES[Number(mes) - 1]} ${anio}`;
}
