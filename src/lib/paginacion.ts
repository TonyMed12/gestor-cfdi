// Paginación de listados (B4, RNF-03): de 50 en 50, sin traer todas las filas de una vez.
// Sin dependencias, para probarla sola (pruebas/paginacion.test.mjs).

export const POR_PAGINA = 50;

export type Pagina = { pagina: number; paginas: number; total: number; desde: number; hasta: number };

// Página pedida en la URL (?pagina=3). Cualquier cosa que no sea un entero positivo es la página 1.
export function leerPagina(texto: string | null | undefined): number {
  const n = Number(texto);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// Filas de la página para Supabase: .range(desde, hasta) es inclusivo en los dos extremos.
export function rangoDePagina(pagina: number, porPagina = POR_PAGINA): { desde: number; hasta: number } {
  const desde = (pagina - 1) * porPagina;
  return { desde, hasta: desde + porPagina - 1 };
}

// Datos para mostrar la navegación. Si la página pedida ya no existe (por ejemplo, se aprobaron facturas),
// se ajusta a la última; con cero filas hay una sola página vacía.
export function describirPagina(paginaPedida: number, total: number, porPagina = POR_PAGINA): Pagina {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, paginaPedida), paginas);
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  return { pagina, paginas, total, desde, hasta };
}

// Una página de una lista que ya está en memoria y ordenada (la bandeja ordena por prioridad antes de paginar).
export function paginaDe<T>(lista: T[], pagina: number, porPagina = POR_PAGINA): T[] {
  const { desde } = rangoDePagina(pagina, porPagina);
  return lista.slice(desde, desde + porPagina);
}
