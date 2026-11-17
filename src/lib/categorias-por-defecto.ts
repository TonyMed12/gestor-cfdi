// Sugerencia de categoría por división del catálogo SAT (los dos primeros dígitos de la clave).
// Se usa cuando el despacho no ha asignado la clave a mano. Si el contador cambia la clave,
// su elección se guarda en clave_categoria y gana sobre esta tabla.
// Los nombres deben coincidir con la lista inicial (10-categorias-iniciales.sql).
// Las divisiones que no aparecen aquí quedan sin sugerencia: el contador las asigna a mano.
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
