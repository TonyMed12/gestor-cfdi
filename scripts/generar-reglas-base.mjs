// Genera src/lib/reglas-base-claves.ts desde scripts/categorias-claves-propuestas.json (A2).
// El JSON es la fuente: trae la descripción del SAT, la categoría y de dónde salió cada regla.
// Uso: node scripts/generar-reglas-base.mjs   (después de editar el JSON)
// Criterio de revisión: docs/15-criterio-reglas-base.md
import { readFileSync, writeFileSync } from "node:fs";

const fuente = new URL("./categorias-claves-propuestas.json", import.meta.url);
const destino = new URL("../src/lib/reglas-base-claves.ts", import.meta.url);

const reglas = JSON.parse(readFileSync(fuente, "utf8"));
const vistas = new Set();
for (const r of reglas) {
  if (!/^\d{8}$/.test(r.clave)) throw new Error(`Clave no válida: ${r.clave}`);
  if (vistas.has(r.clave)) throw new Error(`Clave repetida: ${r.clave}`);
  if (!r.categoria) throw new Error(`La clave ${r.clave} no tiene categoría`);
  vistas.add(r.clave);
}
reglas.sort((a, b) => a.clave.localeCompare(b.clave));

const lineas = [
  `// Reglas base por palabra clave: ${reglas.length} claves del catálogo del SAT con una categoría propuesta.`,
  "// Generado desde scripts/categorias-claves-propuestas.json con scripts/generar-reglas-base.mjs: no editar a mano.",
  "// Se aplican después de la asignación del contador y de la regla por emisor, y antes de la sugerencia por división.",
  "// Todas son categorías de gasto (solo se usan en facturas recibidas). Criterio: docs/15-criterio-reglas-base.md.",
  "// Revisión y ajuste: el contador en Claves del SAT.",
  "export const REGLAS_BASE: Record<string, string> = {",
  ...reglas.map((r) => `  ${JSON.stringify(r.clave)}: ${JSON.stringify(r.categoria)},`),
  "};",
  "",
];
writeFileSync(destino, lineas.join("\n"));
console.log(`Listo: ${reglas.length} reglas en src/lib/reglas-base-claves.ts`);
