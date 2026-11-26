// Bitácora en CSV (D7, RF-47): fecha, usuario, acción, factura y detalle, una fila por registro.
// Sin dependencias de Next, para probarla sola (pruebas/exportar-bitacora.test.mjs).
import { ACCIONES, describirDetalle } from "./bitacora-texto.ts";
import { aCsv } from "./exportar-resumen.ts";

export type RegistroBitacora = {
  ocurrido_en: string;
  accion: string;
  detalle: Record<string, unknown> | null;
  usuario: { nombre: string; correo?: string } | null;
  factura: { uuid_fiscal: string; nombre_emisor: string | null } | null;
};

export const ENCABEZADO_BITACORA = ["Fecha y hora", "Usuario", "Acción", "Factura (emisor)", "Folio fiscal", "Detalle"];

// Fecha y hora del centro de México, en un formato que Excel reconoce: AAAA-MM-DD HH:MM:SS.
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Mexico_City", hour12: false });

// El CSV completo (con BOM, para que Excel lea bien los acentos). `clientes`: id → razón social.
export function csvBitacora(registros: RegistroBitacora[], clientes: Map<string, string> = new Map()): string {
  return aCsv([
    ENCABEZADO_BITACORA,
    ...registros.map((r) => [
      fechaHora(r.ocurrido_en),
      r.usuario?.nombre ?? "",
      ACCIONES[r.accion] ?? r.accion,
      r.factura ? (r.factura.nombre_emisor ?? "") : "",
      r.factura?.uuid_fiscal ?? "",
      describirDetalle(r.accion, r.detalle, clientes) ?? (r.detalle ? JSON.stringify(r.detalle) : ""),
    ]),
  ]);
}

// Nombre del archivo: bitacora-AAAA-MM-DD.csv, con la fecha del día en el centro de México.
export const nombreCsvBitacora = (hoy: Date) =>
  `bitacora-${hoy.toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" })}.csv`;
