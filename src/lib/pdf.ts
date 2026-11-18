import "server-only";
import type { CfdiLeido, ConceptoLeido } from "@/lib/cfdi";

// Texto de un PDF con texto seleccionable, un renglón por línea visual.
export async function leerTextoPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs transfiere el buffer que recibe y lo deja inutilizable: se pasa una copia para no romper el original.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false }).promise;
  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const contenido = await (await doc.getPage(i)).getTextContent();
    let renglon = "";
    let y: number | null = null;
    for (const it of contenido.items) {
      if (!("str" in it)) continue;
      const alto = it.transform[5];
      if (y !== null && Math.abs(alto - y) > 2) {
        texto += renglon + "\n";
        renglon = "";
      }
      renglon += (renglon ? " " : "") + it.str;
      y = alto;
    }
    texto += renglon + "\n";
  }
  return texto;
}

const RFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g;
const UUID = /Folio Fiscal:?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const FECHA_EMISION = /FECHA Y HORA DE EMISI[OÓ]N\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/i;
const FECHA_CERTIFICACION = /Fecha Hora de Certificaci[oó]n:?\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/i;
const CONCEPTO = /^(\d+\.\d{3})\s+([A-Za-z]{1,6})\s.*?\b(\d{8})-(.+)$/m;
const IMPORTES_CONCEPTO = /^\d+\.\d{6}\s+(\d+\.\d{2})\s+(\d+\.\d{2})\s*$/m;

const aIso = (d: string, m: string, a: string, hora: string) => `${a}-${m}-${d}T${hora}:00-06:00`;
const enCentavos = (n: number) => Math.round(n * 100);

// Sello digital del CFDI, impreso en varias líneas en la representación. Se usa para consultar al SAT.
export function selloEn(texto: string): string | null {
  const bloque = texto.match(/SELLO DIGITAL DE CFDI:\s*([\s\S]*?)\s*MUNICIPIO/)?.[1];
  const sello = bloque?.replace(/\s+/g, "");
  return sello && sello.length >= 8 ? sello : null;
}

// Lee los datos de la representación impresa de un CFDI 4.0 con un solo concepto. Si no encuentra algo, dice qué.
export function leerFacturaPdf(texto: string): CfdiLeido | { error: string } {
  const uuid = texto.match(UUID)?.[1]?.toUpperCase();
  if (!uuid) return { error: "No se encontró el folio fiscal (UUID) en el PDF" };

  const emision = texto.match(FECHA_EMISION);
  const certificacion = texto.match(FECHA_CERTIFICACION);
  if (!emision || !certificacion) return { error: "No se encontraron las fechas de emisión y certificación" };

  const receptor = texto.match(/RFC\s*:\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/)?.[1];
  const rfcs = [...new Set(texto.match(RFC) ?? [])];
  const emisor = rfcs.find((r) => r !== receptor);
  if (!receptor || !emisor) return { error: "No se encontraron los RFC del emisor y del receptor" };

  // Montos: el total es el mayor que es suma de otros dos del documento (subtotal + IVA).
  const montos = [...new Set((texto.match(/\d+\.\d{2}\b/g) ?? []).map((m) => enCentavos(Number(m))))];
  let total = 0, subtotal = 0;
  for (const t of [...montos].sort((a, b) => b - a)) {
    const par = montos.find((a) => montos.some((b) => a !== b && a + b === t && a > 0 && b > 0));
    if (par !== undefined) {
      total = t;
      const otro = t - par;
      subtotal = Math.max(par, otro);
      break;
    }
  }
  if (!total) return { error: "No se encontraron el subtotal, el IVA y el total" };

  const concepto = texto.match(CONCEPTO);
  const importes = texto.match(IMPORTES_CONCEPTO);
  if (!concepto || !importes) return { error: "No se pudo leer el concepto (solo se leen facturas con un concepto)" };
  if (texto.match(new RegExp(CONCEPTO.source, "gm"))?.length !== 1) {
    return { error: "El PDF tiene varios conceptos; esta lectura todavía solo cubre facturas con uno" };
  }

  const usoCfdi = texto.match(/\b([A-Z]\d{2})\s*-\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]/)?.[1];
  if (!usoCfdi) return { error: "No se encontró el uso del CFDI" };
  const tipo = texto.match(/TIPO DE COMPROBANTE:\s*([IEPTN])\b/)?.[1];
  if (!tipo) return { error: "No se encontró el tipo de comprobante" };

  const importeConcepto = importes[2];
  const conceptos: ConceptoLeido[] = [{
    clave_prod_serv: concepto[3],
    descripcion: concepto[4].trim(),
    cantidad: concepto[1],
    unidad: concepto[2],
    importe: importeConcepto,
    objeto_impuesto: "02",
    impuestos: [{ tipo: "trasladado", impuesto: "IVA", tasa: 0.16, importe: importes[1] }],
  }];
  const sumaConceptos = enCentavos(Number(importeConcepto));
  const exclusion = sumaConceptos !== subtotal
    ? "Los conceptos no suman el subtotal"
    : null;

  return {
    factura: {
      uuid_fiscal: uuid,
      tipo_comprobante: tipo,
      rfc_emisor: emisor,
      nombre_emisor: texto.split("\n").find((l) => l.trim())?.trim() ?? null,
      rfc_receptor: receptor,
      nombre_receptor: null,
      uso_cfdi: usoCfdi,
      forma_pago: texto.match(/FORMA DE PAGO:\s*(\d{2})\b/)?.[1] ?? null,
      metodo_pago: (texto.match(/\b(PUE|PPD)\b/)?.[1] as "PUE" | "PPD" | undefined) ?? null,
      subtotal: (subtotal / 100).toFixed(2),
      total: (total / 100).toFixed(2),
      moneda: texto.match(/MONEDA:\s*([A-Z]{3})/)?.[1] ?? "MXN",
      emitido_en: aIso(emision[1], emision[2], emision[3], emision[4]),
      timbrado_en: aIso(certificacion[1], certificacion[2], certificacion[3], certificacion[4]),
      sello: selloEn(texto),
      regimen_receptor: texto.match(/REGIMEN FISCAL RECEPTOR:\s*(\d{3})/)?.[1] ?? null,
      relacionados: [],
    },
    conceptos,
    exclusion,
  };
}

// Datos que la factura guardada no conserva, leídos del mismo PDF para mostrarlos como en el XML.
export type DatosAdicionalesPdf = {
  serie: string | null;
  folio: string | null;
  lugarExpedicion: string | null;
  regimenEmisor: string | null;
  valorUnitario: string | null;
  unidad: string | null;
};

export function datosAdicionalesPdf(texto: string): DatosAdicionalesPdf {
  const precio = texto.match(/^(\d+\.\d{6})\s+\d+\.\d{2}\s+\d+\.\d{2}\s*$/m)?.[1] ?? null;
  return {
    serie: texto.match(/SERIE:\s*([A-Za-z0-9]+)/)?.[1] ?? null,
    folio: texto.match(/FOLIO:\s*([A-Za-z0-9]+)/)?.[1] ?? null,
    lugarExpedicion: texto.match(/LUGAR DE EXPEDICI[OÓ]N:?\s*(\d{5})/i)?.[1] ?? null,
    regimenEmisor: texto.match(/REGIMEN FISCAL EMISOR:\s*(\d{3})/)?.[1] ?? null,
    valorUnitario: precio,
    unidad: texto.match(/^\d+\.\d{3}\s+([A-Za-z]{1,6})\s/m)?.[1] ?? null,
  };
}
