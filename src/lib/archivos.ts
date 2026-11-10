import { strFromU8, unzipSync } from "fflate";

export const MAX_BYTES = 20 * 1024 * 1024; // RNF-10, por archivo
export const MAX_ZIP_BYTES = 100 * 1024 * 1024; // el ZIP se lee completo en memoria
const MAX_ENTRADAS_ZIP = 500;
const MAX_DESCOMPRIMIDO = 200 * 1024 * 1024; // suma de lo que se descomprime de un ZIP

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
  // Sin punto (o solo un punto inicial, como ".xml") no hay extensión.
  const punto = nombre.lastIndexOf(".");
  const ext = punto > 0 ? nombre.slice(punto + 1).toLowerCase() : "";
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

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// CRC-32 que el directorio central del ZIP declara para cada archivo, por nombre.
function crcDeclarados(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const crcs = new Map<string, number>();
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) return crcs;
  let p = v.getUint32(fin + 16, true);
  const cantidad = v.getUint16(fin + 10, true);
  for (let k = 0; k < cantidad && p + 46 <= bytes.length && v.getUint32(p, true) === 0x02014b50; k++) {
    const largo = v.getUint16(p + 28, true);
    const utf8 = (v.getUint16(p + 8, true) & 0x800) !== 0;
    crcs.set(strFromU8(bytes.subarray(p + 46, p + 46 + largo), !utf8), v.getUint32(p + 16, true));
    p += 46 + largo + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return crcs;
}

// Abre un ZIP. Los archivos que superan el límite se informan como rechazados, sin descomprimirlos.
// fflate confía en el tamaño que declara el ZIP y no revisa el CRC: un ZIP alterado entregaría el
// archivo truncado sin error. Por eso se compara el CRC-32 de cada archivo con el declarado.
export function extraerZip(bytes: Uint8Array):
  | { archivos: ArchivoLeido[]; rechazados: { nombre: string; motivo: string }[] }
  | { error: string } {
  const rechazados: { nombre: string; motivo: string }[] = [];
  let entradas = 0;
  let total = 0;
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
        total += f.originalSize;
        if (total > MAX_DESCOMPRIMIDO) return false;
        return true;
      },
    });
    if (entradas > MAX_ENTRADAS_ZIP) {
      return { error: `El ZIP tiene más de ${MAX_ENTRADAS_ZIP} archivos` };
    }
    if (total > MAX_DESCOMPRIMIDO) {
      return { error: "El contenido del ZIP pasa de 200 MB; divídelo en varios" };
    }
    const crcs = crcDeclarados(bytes);
    const archivos: ArchivoLeido[] = [];
    for (const [nombre, datos] of Object.entries(contenido)) {
      if (crc32(datos) !== crcs.get(nombre)) {
        rechazados.push({ nombre: nombreBase(nombre), motivo: "Está dañado dentro del ZIP" });
      } else {
        archivos.push({ nombre: nombreBase(nombre), bytes: datos });
      }
    }
    return { archivos, rechazados };
  } catch {
    return { error: "El ZIP está dañado o no se puede abrir" };
  }
}
