import "server-only";
import path from "node:path";
import { createWorker } from "tesseract.js";

// Lectura local (RNF: los datos fiscales no salen del servidor). El modelo en español viene en el paquete.
const CARPETA_IDIOMA = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "spa", "4.0.0_best_int");

// OCR de una foto o imagen escaneada. Es lento y menos preciso que el texto de un PDF.
export async function leerTextoImagen(bytes: Uint8Array): Promise<string> {
  const worker = await createWorker("spa", 1, {
    langPath: CARPETA_IDIOMA,
    gzip: true,
    cacheMethod: "none",
  });
  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    return data.text;
  } finally {
    await worker.terminate();
  }
}

