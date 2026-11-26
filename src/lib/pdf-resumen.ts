// Resumen del periodo en PDF (D3, RF-42): encabezado del cliente y del periodo, totales, resumen por categoría
// y facturas fuera del resumen. Hoja carta; cabe en una o dos hojas (las listas largas se recortan con aviso).
// Sin dependencias de Next, para probarlo solo (pruebas/pdf-resumen.test.mjs). Las cifras son las de calcularResumen.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { agruparExclusiones, type FilaResumen } from "./resumen.ts";
import type { DatosExportacion, FacturaExportable } from "./exportar-resumen.ts";

export type DatosPdf = DatosExportacion & {
  cierre?: string; // «Periodo cerrado el … por …» (D4), si está cerrado
};

// Facturas que se listan por motivo de exclusión; el resto se cuenta («y 5 más»), para no pasar de dos hojas.
export const MAXIMO_POR_MOTIVO = 10;

// Hoja carta en puntos (72 por pulgada).
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 40;
const PIE = 36; // espacio para el pie de página
const UTIL = ANCHO - 2 * MARGEN;

// Colores de la aplicación.
const VERDE = rgb(0x0e / 255, 0x7c / 255, 0x66 / 255);
const VERDE_SUAVE = rgb(0xe6 / 255, 0xf4 / 255, 0xf0 / 255);
const TEXTO = rgb(0x11 / 255, 0x18 / 255, 0x27 / 255);
const GRIS = rgb(0x4b / 255, 0x55 / 255, 0x63 / 255);
const LINEA = rgb(0xd5 / 255, 0xdb / 255, 0xe1 / 255);
const ZEBRA = rgb(0xf6 / 255, 0xf8 / 255, 0xfa / 255);
const ROJO = rgb(0xb4 / 255, 0x23 / 255, 0x18 / 255);
const BLANCO = rgb(1, 1, 1);

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaMexico = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" });

type Alineacion = "izquierda" | "derecha";

class Lienzo {
  doc: PDFDocument;
  normal: PDFFont;
  negrita: PDFFont;
  pagina!: PDFPage;
  y = 0;
  private permitidos: Set<number>;

  constructor(doc: PDFDocument, normal: PDFFont, negrita: PDFFont) {
    this.doc = doc;
    this.normal = normal;
    this.negrita = negrita;
    // Las fuentes estándar del PDF (WinAnsi) tienen acentos, ñ, ü, «» y signos de pesos, pero no todo Unicode.
    this.permitidos = new Set(normal.getCharacterSet());
    this.nuevaPagina();
  }

  nuevaPagina() {
    this.pagina = this.doc.addPage([ANCHO, ALTO]);
    this.y = ALTO - MARGEN;
  }

  // ¿Cabe un bloque de `alto` puntos? Si no, pasa a otra hoja. Devuelve true si cambió de hoja.
  asegurar(alto: number): boolean {
    if (this.y - alto >= MARGEN + PIE) return false;
    this.nuevaPagina();
    return true;
  }

  // Texto de terceros: lo que la fuente no puede dibujar se cambia por «?» (en lugar de romper el PDF).
  limpio(t: string): string {
    return [...t.replace(/\s+/g, " ")].map((c) => (this.permitidos.has(c.codePointAt(0)!) ? c : "?")).join("");
  }

  ancho(t: string, tam: number, fuente = this.normal) {
    return fuente.widthOfTextAtSize(t, tam);
  }

  // Recorta con «…» para que quepa en `maximo` puntos.
  recortar(t: string, tam: number, maximo: number, fuente = this.normal): string {
    if (this.ancho(t, tam, fuente) <= maximo) return t;
    let s = t;
    while (s.length > 1 && this.ancho(`${s}…`, tam, fuente) > maximo) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  }

  texto(
    t: string,
    x: number,
    y: number,
    { tam = 9, fuente = this.normal, color = TEXTO, alinear = "izquierda" as Alineacion, maximo = 0, ajustar = false } = {},
  ) {
    let s = this.limpio(t);
    let tamano = tam;
    if (maximo > 0) {
      // Las cifras se achican para caber completas; los textos se recortan.
      if (ajustar) while (tamano > 6 && this.ancho(s, tamano, fuente) > maximo) tamano -= 0.25;
      else s = this.recortar(s, tamano, maximo, fuente);
    }
    const xFinal = alinear === "derecha" ? x - this.ancho(s, tamano, fuente) : x;
    this.pagina.drawText(s, { x: xFinal, y, size: tamano, font: fuente, color });
  }

  // Párrafo que se parte en renglones por palabras.
  parrafo(t: string, { tam = 9, color = GRIS, fuente = this.normal, interlinea = 12 } = {}) {
    const palabras = this.limpio(t).split(" ");
    let renglon = "";
    const renglones: string[] = [];
    for (const p of palabras) {
      const prueba = renglon ? `${renglon} ${p}` : p;
      if (this.ancho(prueba, tam, fuente) > UTIL && renglon) {
        renglones.push(renglon);
        renglon = p;
      } else renglon = prueba;
    }
    if (renglon) renglones.push(renglon);
    for (const r of renglones) {
      this.asegurar(interlinea);
      this.texto(r, MARGEN, this.y - tam, { tam, color, fuente });
      this.y -= interlinea;
    }
  }

  rect(x: number, y: number, w: number, h: number, color = ZEBRA) {
    this.pagina.drawRectangle({ x, y, width: w, height: h, color });
  }

  linea(y: number, color = LINEA, grosor = 0.75) {
    this.pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: grosor, color });
  }

  seccion(titulo: string) {
    this.asegurar(40);
    this.y -= 14;
    this.texto(titulo, MARGEN, this.y - 12, { tam: 12, fuente: this.negrita, color: VERDE });
    this.y -= 20;
  }
}

type Columna = { titulo: string; ancho: number; alinear: Alineacion };

// Encabezado de una tabla en verde con letra blanca.
function encabezadoTabla(l: Lienzo, columnas: Columna[]) {
  const alto = 18;
  l.rect(MARGEN, l.y - alto, UTIL, alto, VERDE);
  let x = MARGEN;
  for (const c of columnas) {
    const pos = c.alinear === "derecha" ? x + c.ancho - 4 : x + 4;
    // Los títulos se achican para caber completos («IVA acreditable»), no se cortan.
    l.texto(c.titulo, pos, l.y - 12, { tam: 7.5, fuente: l.negrita, color: BLANCO, alinear: c.alinear, maximo: c.ancho - 8, ajustar: true });
    x += c.ancho;
  }
  l.y -= alto;
}

// Una fila de la tabla. Si no cabe, sigue en otra hoja con el encabezado repetido.
function filaTabla(
  l: Lienzo,
  columnas: Columna[],
  celdas: string[],
  { fondo, negrita = false, color = TEXTO, cifrasDesde = 1 }: { fondo?: ReturnType<typeof rgb>; negrita?: boolean; color?: ReturnType<typeof rgb>; cifrasDesde?: number } = {},
) {
  const alto = 16;
  if (l.asegurar(alto)) encabezadoTabla(l, columnas);
  if (fondo) l.rect(MARGEN, l.y - alto, UTIL, alto, fondo);
  let x = MARGEN;
  columnas.forEach((c, i) => {
    const pos = c.alinear === "derecha" ? x + c.ancho - 4 : x + 4;
    l.texto(celdas[i] ?? "", pos, l.y - 11, {
      tam: 8,
      fuente: negrita ? l.negrita : l.normal,
      color,
      alinear: c.alinear,
      maximo: c.ancho - 8,
      ajustar: i >= cifrasDesde,
    });
    x += c.ancho;
  });
  l.y -= alto;
}

function tarjetas(l: Lienzo, lista: { etiqueta: string; valor: number; nota?: string }[]) {
  const porFila = 4;
  const sep = 8;
  const w = (UTIL - sep * (porFila - 1)) / porFila;
  const h = 46;
  for (let i = 0; i < lista.length; i += porFila) {
    l.asegurar(h + sep);
    lista.slice(i, i + porFila).forEach((t, j) => {
      const x = MARGEN + j * (w + sep);
      l.rect(x, l.y - h, w, h, VERDE_SUAVE);
      l.texto(t.etiqueta, x + 8, l.y - 13, { tam: 8, color: GRIS, maximo: w - 16 });
      l.texto(pesos(t.valor), x + 8, l.y - 29, { tam: 12.5, fuente: l.negrita, maximo: w - 16, ajustar: true });
      if (t.nota) l.texto(t.nota, x + 8, l.y - 40, { tam: 6.5, color: GRIS, maximo: w - 16 });
    });
    l.y -= h + sep;
  }
}

function contraparte(f: FacturaExportable) {
  const recibida = f.relacion === "recibida";
  return (recibida ? f.nombreEmisor : f.nombreReceptor) ?? (recibida ? f.rfcEmisor : f.rfcReceptor);
}

export async function pdfResumen(d: DatosPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Resumen del periodo ${d.periodo.nombre} · ${d.cliente.razonSocial}`);
  doc.setSubject(`Resumen de ${d.cliente.razonSocial} (${d.cliente.rfc}), ${d.periodo.nombre}`);
  doc.setCreator("Lector de facturas");
  doc.setProducer("Lector de facturas");
  doc.setCreationDate(d.generado);
  const l = new Lienzo(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  const { resumen } = d;
  const t = resumen.totales;

  // Encabezado del cliente y del periodo.
  const mes = d.periodo.nombre.charAt(0).toUpperCase() + d.periodo.nombre.slice(1);
  l.texto(`Resumen del periodo · ${mes}`, MARGEN, l.y - 18, { tam: 18, fuente: l.negrita, maximo: UTIL });
  l.y -= 30;
  l.texto(d.cliente.razonSocial, MARGEN, l.y - 11, { tam: 11, fuente: l.negrita, maximo: UTIL - 140 });
  l.texto(`RFC ${d.cliente.rfc}`, ANCHO - MARGEN, l.y - 11, { tam: 10, color: GRIS, alinear: "derecha" });
  l.y -= 17;
  const estado = d.periodo.estado === "cerrado" ? (d.cierre ?? "Periodo cerrado.") : "Periodo abierto: las cifras pueden cambiar.";
  l.texto(estado, MARGEN, l.y - 9, { tam: 8.5, color: d.periodo.estado === "cerrado" ? TEXTO : GRIS, maximo: UTIL - 190 });
  l.texto(
    `Generado el ${d.generado.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" })}`,
    ANCHO - MARGEN,
    l.y - 9,
    { tam: 8.5, color: GRIS, alinear: "derecha" },
  );
  l.y -= 16;
  l.linea(l.y, VERDE, 1.25);
  l.y -= 10;
  l.parrafo(
    `${d.facturas.length} ${d.facturas.length === 1 ? "factura" : "facturas"} en el periodo = ${resumen.incluidas} ${resumen.incluidas === 1 ? "incluida" : "incluidas"} + ${resumen.excluidas.length} fuera del resumen. Solo cuentan las facturas aprobadas que no están canceladas; las notas de crédito restan.`,
  );
  l.y -= 6;

  // Totales.
  tarjetas(l, [
    { etiqueta: "Ingresos", valor: t.ingresos },
    { etiqueta: "Gastos", valor: t.gastos },
    { etiqueta: "Gastos deducibles", valor: t.gastosDeducibles, nota: "Por la factura o su categoría" },
    { etiqueta: "IVA trasladado", valor: t.ivaTrasladado, nota: "Cobrado en los ingresos" },
    { etiqueta: "IVA acreditable", valor: t.ivaAcreditable, nota: "16 % u 8 % de gastos deducibles" },
    { etiqueta: "Retenciones a favor", valor: t.retencionesAFavor, nota: "Le retuvieron al cliente" },
    { etiqueta: "Retenciones por enterar", valor: t.retencionesPorEnterar, nota: "Retuvo el cliente" },
  ]);
  if (resumen.ajusteNoDesglosado.facturas > 0) {
    l.parrafo(
      `En ${resumen.ajusteNoDesglosado.facturas} factura(s) el total no coincide con sus conceptos e impuestos guardados: diferencia de ${pesos(resumen.ajusteNoDesglosado.importe)} (descuentos o impuestos locales). No está en las cifras de arriba.`,
      { color: ROJO },
    );
  }

  // Por categoría, separando ingresos y gastos, con su subtotal.
  l.seccion("Por categoría");
  const hayIeps = resumen.filas.some((f) => f.iepsTrasladado !== 0);
  const cifras: { titulo: string; valor: (f: FilaResumen) => number | null }[] = [
    { titulo: "Importe", valor: (f) => f.importe },
    { titulo: "Deducible", valor: (f) => (f.tipo === "Gasto" ? f.gastoDeducible : null) },
    { titulo: "IVA trasladado", valor: (f) => f.ivaTrasladado },
    { titulo: "IVA acreditable", valor: (f) => (f.tipo === "Gasto" ? f.ivaAcreditable : null) },
    ...(hayIeps ? [{ titulo: "IEPS", valor: (f: FilaResumen) => f.iepsTrasladado }] : []),
    { titulo: "ISR retenido", valor: (f) => f.isrRetenido },
    { titulo: "IVA retenido", valor: (f) => f.ivaRetenido },
  ];
  const anchoCifra = hayIeps ? 52 : 56;
  const anchoFacturas = 40;
  const columnas: Columna[] = [
    { titulo: "Categoría", ancho: UTIL - anchoFacturas - anchoCifra * cifras.length, alinear: "izquierda" },
    { titulo: "Facturas", ancho: anchoFacturas, alinear: "derecha" },
    ...cifras.map((c) => ({ titulo: c.titulo, ancho: anchoCifra, alinear: "derecha" as const })),
  ];
  if (resumen.filas.length === 0) {
    l.parrafo("Aún no hay facturas aprobadas en este periodo.");
  } else {
    l.asegurar(18 + 16 * 2);
    encabezadoTabla(l, columnas);
    for (const tipo of ["Ingreso", "Gasto"] as const) {
      const filas = resumen.filas.filter((f) => f.tipo === tipo);
      if (filas.length === 0) continue;
      filaTabla(l, columnas, [tipo === "Ingreso" ? "Ingresos" : "Gastos"], { negrita: true, color: VERDE });
      filas.forEach((f, i) =>
        filaTabla(
          l,
          columnas,
          [f.categoria, String(f.facturas), ...cifras.map((c) => { const v = c.valor(f); return v === null ? "—" : pesos(v); })],
          { fondo: i % 2 === 1 ? ZEBRA : undefined },
        ),
      );
      // Subtotal del grupo: suma en centavos, igual que el resumen.
      const suma = (c: (typeof cifras)[number]) => {
        const valores = filas.map(c.valor);
        return valores.every((v) => v === null) ? "—" : pesos(valores.reduce<number>((s, v) => s + Math.round((v ?? 0) * 100), 0) / 100);
      };
      filaTabla(
        l,
        columnas,
        [`Total ${tipo === "Ingreso" ? "ingresos" : "gastos"}`, "", ...cifras.map(suma)],
        { fondo: VERDE_SUAVE, negrita: true },
      );
    }
  }

  // Fuera del resumen: por motivo, con sus facturas (C5).
  const grupos = agruparExclusiones(resumen.excluidas);
  l.seccion(`Fuera del resumen · ${resumen.excluidas.length} de ${d.facturas.length}`);
  if (grupos.length === 0) {
    l.parrafo("Todas las facturas del periodo están incluidas.");
  } else {
    const porId = new Map(d.facturas.map((f) => [f.id, f]));
    const colsFuera: Columna[] = [
      { titulo: "Fecha", ancho: 70, alinear: "izquierda" },
      { titulo: "Emisor o receptor", ancho: UTIL - 70 - 172 - 80, alinear: "izquierda" },
      { titulo: "Folio fiscal", ancho: 172, alinear: "izquierda" },
      { titulo: "Total", ancho: 80, alinear: "derecha" },
    ];
    for (const g of grupos) {
      l.asegurar(16 + 18 + 16);
      l.texto(`${g.motivo} · ${g.facturas.length === 1 ? "1 factura" : `${g.facturas.length} facturas`}`, MARGEN, l.y - 11, {
        tam: 9.5,
        fuente: l.negrita,
        maximo: UTIL,
      });
      l.y -= 16;
      encabezadoTabla(l, colsFuera);
      g.facturas.slice(0, MAXIMO_POR_MOTIVO).forEach((e, i) => {
        const f = porId.get(e.id);
        if (!f) return;
        filaTabla(
          l,
          colsFuera,
          [fechaMexico(f.fecha), contraparte(f), f.uuid, pesos(f.total)],
          // El folio fiscal va completo (se achica si hace falta): es lo que identifica la factura.
          { fondo: i % 2 === 1 ? ZEBRA : undefined, cifrasDesde: 2 },
        );
      });
      const resto = g.facturas.length - MAXIMO_POR_MOTIVO;
      if (resto > 0) {
        l.asegurar(14);
        l.texto(`… y ${resto} más. La lista completa está en la exportación a Excel (hoja «Detalle»).`, MARGEN + 4, l.y - 10, {
          tam: 8,
          color: GRIS,
        });
        l.y -= 14;
      }
      l.y -= 8;
    }
  }

  // Pie de página en cada hoja.
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    l.pagina = p;
    l.linea(MARGEN + 14);
    l.texto(`${d.cliente.razonSocial} · ${d.periodo.nombre}`, MARGEN, MARGEN, { tam: 7.5, color: GRIS, maximo: UTIL - 90 });
    l.texto(`Página ${i + 1} de ${paginas.length}`, ANCHO - MARGEN, MARGEN, { tam: 7.5, color: GRIS, alinear: "derecha" });
  });

  return doc.save();
}

// Nombre del archivo: resumen-<RFC>-<AAAA-MM>.pdf (mismo criterio que el CSV y el Excel).
export const nombrePdf = (rfc: string, mesAnio: string) =>
  `resumen-${rfc.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${mesAnio.replace(/[^0-9-]/g, "")}.pdf`;
