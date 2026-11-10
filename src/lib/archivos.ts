import { unzipSync } from "fflate";

export const MAX_BYTES = 20 * 1024 * 1024; // RNF-10, por archivo
export const MAX_ZIP_BYTES = 100 * 1024 * 1024; // el ZIP se lee completo en memoria
const MAX_ENTRADAS_ZIP = 500;

export type TipoArchivo = "xml" | "pdf" | "imagen";
export type Clasificado = { tipo: TipoArchivo; mime: string };
export type ArchivoLeido = { nombre: string; bytes: Uint8Array };

const POR_EXTENSION: Record<string, Clasificado> = {
  xml: { tipo: "xml", mime: "application/xml" },
  pdf: { tipo: "pdf", mime: "application/pdf" },
  jpg: { tipo: "imagen", mime: "image/jpeg" },
  jpeg: { tipo: "imagen", mime: "image/jpeg" },
  png: { tipo: "imagen", mime: "image/png" },
};

const empieza = (b: Uint8Array, firma: number[]) => firma.every((v, i) => b[i] === v);

// Un XML válido empieza con "<" (se permiten BOM y espacios antes).
function pareceXml(b: Uint8Array) {
  let i = empieza(b, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (i < b.length && [0x20, 0x09, 0x0a, 0x0d].includes(b[i])) i++;
  return b[i] === 0x3c;
}

export const nombreBase = (ruta: string) => ruta.split(/[\\/]/).pop() ?? ruta;

// Devuelve el tipo del archivo o el motivo de rechazo. Revisa extensión, tamaño y que el contenido corresponda.
export function clasificar(nombre: string, bytes: Uint8Array): Clasificado | { error: string } {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  const tipo = POR_EXTENSION[ext];
  if (!tipo) return { error: "Tipo no permitido (solo XML, PDF, JPG, PNG o ZIP)" };
  if (bytes.length === 0) return { error: "El archivo está vacío" };
  if (bytes.length > MAX_BYTES) return { error: "Pasa de 20 MB" };
  const coincide =
    ext === "xml" ? pareceXml(bytes)
    : ext === "pdf" ? empieza(bytes, [0x25, 0x50, 0x44, 0x46])
    : ext === "png" ? empieza(bytes, [0x89, 0x50, 0x4e, 0x47])
    : empieza(bytes, [0xff, 0xd8, 0xff]);
  return coincide ? tipo : { error: "El contenido no corresponde a su extensión" };
}

// Nombre apto para la ruta de almacenamiento: sin acentos, espacios ni símbolos raros.
export const nombreSeguro = (nombre: string) =>
  nombreBase(nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(-120) || "archivo";

export async function huellaSha256(bytes: Uint8Array) {
  const resumen = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Abre un ZIP. Los archivos que superan el límite se informan como rechazados, sin descomprimirlos.
// Limitación: se confía en el tamaño declarado en el ZIP para decidir qué descomprimir.
export function extraerZip(bytes: Uint8Array):
  | { archivos: ArchivoLeido[]; rechazados: { nombre: string; motivo: string }[] }
  | { error: string } {
  const rechazados: { nombre: string; motivo: string }[] = [];
  let entradas = 0;
  try {
    const contenido = unzipSync(bytes, {
      filter: (f) => {
        if (f.name.endsWith("/") || f.name.startsWith("__MACOSX/")) return false;
        entradas++;
        if (entradas > MAX_ENTRADAS_ZIP) return false;
        if (f.originalSize > MAX_BYTES) {
          rechazados.push({ nombre: nombreBase(f.name), motivo: "Pasa de 20 MB" });
          return false;
        }
        return true;
      },
    });
    if (entradas > MAX_ENTRADAS_ZIP) {
      return { error: `El ZIP tiene más de ${MAX_ENTRADAS_ZIP} archivos` };
    }
    const archivos = Object.entries(contenido).map(([nombre, datos]) => ({ nombre: nombreBase(nombre), bytes: datos }));
    return { archivos, rechazados };
  } catch {
    return { error: "El ZIP está dañado o no se puede abrir" };
  }
}
