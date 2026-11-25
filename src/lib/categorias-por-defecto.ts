import type { OrigenClasificacion } from "./types";

// Sugerencia de categoría por división del catálogo SAT (los dos primeros dígitos de la clave).
// Se usa cuando el despacho no ha asignado la clave a mano. Si el contador cambia la clave,
// su elección se guarda en clave_categoria y gana sobre esta tabla.
// Los nombres deben coincidir con la lista inicial (10-categorias-iniciales.sql).
// Las divisiones que no aparecen aquí quedan sin sugerencia: el contador las asigna a mano.
// Todas son categorías de gasto: solo se usan en facturas recibidas.
export const CATEGORIA_POR_DIVISION: Record<string, string> = {
  "15": "Combustible, viáticos y transporte",     // combustibles y lubricantes
  "78": "Combustible, viáticos y transporte",     // transporte y almacenamiento
  "90": "Combustible, viáticos y transporte",     // viajes, hospedaje y comidas
  "43": "Equipo de cómputo y software",           // tecnología y equipo de cómputo
  "44": "Gastos de oficina y papelería",          // oficina y papelería
  "72": "Mantenimiento y reparaciones",           // servicios de construcción y mantenimiento
  "80": "Honorarios y servicios profesionales",   // consultoría y servicios de gestión
  "81": "Honorarios y servicios profesionales",   // ingeniería y servicios técnicos
  "82": "Publicidad y marketing",                 // publicidad y diseño
  "30": "Compras de mercancía o insumos",         // materiales y componentes
  "31": "Compras de mercancía o insumos",
  "32": "Compras de mercancía o insumos",
  "50": "Compras de mercancía o insumos",         // alimentos
  "51": "Compras de mercancía o insumos",         // medicamentos
};

export const categoriaSugeridaDeClave = (clave: string): string | null =>
  CATEGORIA_POR_DIVISION[clave.slice(0, 2)] ?? null;

// Categorías de ingreso de la lista inicial (10-categorias-iniciales.sql). Las demás son de gasto.
// Una factura emitida es un ingreso del cliente y una recibida es un gasto, así que una categoría
// de gasto nunca se propone en una emitida, ni una de ingreso en una recibida.
export const CATEGORIAS_DE_INGRESO: ReadonlySet<string> = new Set([
  "Ventas de bienes",
  "Servicios prestados",
  "Otros ingresos",
]);

export const esCategoriaDeIngreso = (nombre: string): boolean => CATEGORIAS_DE_INGRESO.has(nombre);

// Ingreso sugerido para una factura emitida: los segmentos 70 a 94 del catálogo son servicios;
// los demás, bienes.
export const categoriaDeIngresoDeClave = (clave: string): string => {
  const segmento = Number(clave.slice(0, 2));
  return segmento >= 70 && segmento <= 94 ? "Servicios prestados" : "Ventas de bienes";
};

// Elige la categoría de un concepto, en este orden:
// 1) clave asignada a mano · 2) regla por emisor · 3) regla base · 4) sugerencia por la clave · 5) sin clasificar.
// En cada paso solo cuenta una categoría del lado correcto (ingreso en emitidas, gasto en recibidas).
// En emitidas, la sugerencia por la clave es «Servicios prestados» o «Ventas de bienes».
export function elegirCategoria(p: {
  clave: string;
  relacion: "emitida" | "recibida";
  manual?: string;
  deEmisor?: string;
  base?: string;
}): { categoria?: string; origen?: OrigenClasificacion } {
  const emitida = p.relacion === "emitida";
  const encaja = (nombre?: string): nombre is string =>
    !!nombre && esCategoriaDeIngreso(nombre) === emitida;

  if (encaja(p.manual)) return { categoria: p.manual, origen: "regla" };
  if (encaja(p.deEmisor)) return { categoria: p.deEmisor, origen: "emisor" };
  if (encaja(p.base)) return { categoria: p.base, origen: "base" };
  if (emitida) return { categoria: categoriaDeIngresoDeClave(p.clave), origen: "division" };
  const sugerida = categoriaSugeridaDeClave(p.clave);
  return sugerida ? { categoria: sugerida, origen: "division" } : {};
}
