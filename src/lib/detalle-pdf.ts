import "server-only";
import type { DetalleCfdi } from "@/lib/cfdi";
import { getFacturaDeArchivo } from "@/lib/datos";
import type { Factura } from "@/lib/types";
import { datosAdicionalesPdf, leerTextoPdf, type DatosAdicionalesPdf } from "@/lib/pdf";
import { supabaseServidor } from "@/lib/supabase-servidor";

const P = (motivo: string) => `PENDIENTE: ${motivo}`;

// Arma el mismo resumen que el XML con los datos de la factura leída del PDF.
// Lo que no se pudo leer queda como PENDIENTE, y las dudas van en `notas`.
function armarDetallePdf(f: Factura, ad: DatosAdicionalesPdf): DetalleCfdi {
  const notas: string[] = [];
  const iva = f.conceptos.flatMap((c) => c.impuestos).filter((i) => i.impuesto === "IVA" && i.tipo === "trasladado");
  const ivaTotal = iva.reduce((s, i) => s + i.importe, 0);
  const ivaEsperado = Math.round(f.subtotal * 0.16 * 100) / 100;
  if (iva.length > 0 && Math.abs(ivaTotal - ivaEsperado) > 0.01) {
    notas.push(`El IVA (${ivaTotal.toFixed(2)}) no es el 16 % del subtotal (${ivaEsperado.toFixed(2)}). Revisa el PDF o el XML.`);
  }
  if (f.motivoExclusion) notas.push(`Excluida: ${f.motivoExclusion}.`);
  const unico = f.conceptos.length === 1;
  if (!unico) notas.push("El PDF tiene varios conceptos; solo se muestran los importes de cada uno.");

  const agrupar = (tipo: "trasladado" | "retenido") => {
    const mapa = new Map<string, number>();
    for (const c of f.conceptos) {
      for (const i of c.impuestos) {
        if (i.tipo !== tipo) continue;
        mapa.set(i.impuesto, (mapa.get(i.impuesto) ?? 0) + i.importe);
      }
    }
    return [...mapa].map(([impuesto, importe]) => ({ impuesto, importe: importe.toFixed(2) }));
  };

  return {
    version: "4.0",
    tipo: f.tipoComprobante,
    timbrado: true,
    serie: ad.serie ?? P("no aparece en el PDF"),
    folio: ad.folio ?? P("no aparece en el PDF"),
    fecha: new Date(f.fechaEmision).toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }),
    lugarExpedicion: ad.lugarExpedicion ?? P("no se pudo leer"),
    moneda: f.moneda,
    metodoPago: f.metodoPago ?? P("no aparece en el PDF"),
    formaPago: f.formaPago ?? P("vacío en el PDF"),
    subtotal: f.subtotal.toFixed(2),
    descuento: null,
    total: f.total.toFixed(2),
    traslados: agrupar("trasladado"),
    retenciones: agrupar("retenido"),
    locales: [],
    emisor: {
      rfc: f.emisorRfc,
      nombre: f.emisorNombre,
      regimen: ad.regimenEmisor ?? P("no se encontró en el PDF"),
    },
    receptor: {
      rfc: f.receptorRfc,
      nombre: f.receptorNombre === f.receptorRfc ? P("no aparece en el PDF") : f.receptorNombre,
      uso: f.usoCfdi,
      codigoPostal: P("no se extrae del PDF"),
      regimen: f.regimenReceptor ?? P("no se encontró en el PDF"),
    },
    uuid: f.uuidFiscal,
    fechaTimbrado: new Date(f.fechaTimbrado).toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }),
    conceptos: f.conceptos.map((c) => ({
      clave: c.claveProdServ,
      descripcion: c.descripcion,
      cantidad: String(c.cantidad),
      valorUnitario: unico && ad.valorUnitario ? ad.valorUnitario : P("no se leyó del PDF"),
      importe: c.importe.toFixed(2),
      claveUnidad: null,
      unidad: unico && ad.unidad ? ad.unidad : P("no se leyó del PDF"),
      impuestos: c.impuestos.map((i) => ({
        tipo: i.tipo,
        impuesto: i.impuesto,
        tasa: String(i.tasa),
        importe: i.importe.toFixed(2),
      })),
    })),
    notas,
  };
}

// Resumen de una factura leída de PDF: vuelve a leer el PDF guardado para los datos que la factura no conserva.
export async function detallePdfArchivo(archivoId: string, ruta: string): Promise<DetalleCfdi | { error: string }> {
  const factura = await getFacturaDeArchivo(archivoId);
  if (!factura) return { error: "No hay factura leída de este PDF" };
  const supabase = await supabaseServidor();
  const { data: descarga } = await supabase.storage.from("facturas").download(ruta);
  const texto = descarga ? await leerTextoPdf(new Uint8Array(await descarga.arrayBuffer())) : "";
  return armarDetallePdf(factura, datosAdicionalesPdf(texto));
}
