// Libro de Excel (.xlsx) mínimo, sin dependencias nuevas (D2): un .xlsx es un ZIP con archivos XML
// (Office Open XML). Se arma aquí con los estilos que usa la exportación y se comprime con fflate,
// que el proyecto ya usa para leer ZIP. Se prueba en pruebas/exportar-resumen.test.mjs.
import { strToU8, zipSync } from "fflate";

export type Estilo =
  | "normal" | "titulo" | "subtitulo" | "tenue" | "seccion" | "encabezado" | "encabezadoDerecha"
  | "moneda" | "monedaTenue" | "monedaTotal" | "total" | "entero" | "fecha" | "fechaTenue" | "tenueDerecha";

// El índice de cada estilo en <cellXfs> de styles.xml (mismo orden).
const ESTILOS: Estilo[] = [
  "normal", "titulo", "subtitulo", "tenue", "seccion", "encabezado", "encabezadoDerecha",
  "moneda", "monedaTenue", "monedaTotal", "total", "entero", "fecha", "fechaTenue", "tenueDerecha",
];

export type Celda = {
  // Texto, número, fecha (AAAA-MM-DD, se guarda como fecha de Excel) o vacía.
  v: string | number | { fecha: string } | null;
  estilo?: Estilo;
  // Fórmula sin el signo =, por ejemplo "SUM(O2:O9)". `v` es el valor ya calculado, que Excel muestra al abrir.
  formula?: string;
};

export type Hoja = {
  nombre: string; // máximo 31 caracteres, sin : \ / ? * [ ]
  anchos: number[]; // ancho de cada columna, en caracteres
  filas: Celda[][];
  congelarFilas?: number; // filas de arriba que quedan fijas al desplazarse
  filtro?: { columnas: number; filas: number }; // filtros de Excel desde A1
  sinCuadricula?: boolean;
};

// Letra de columna de Excel para un índice desde 0: 0 → A, 25 → Z, 26 → AA.
export function columna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Texto seguro para XML: escapa & < > " y quita los caracteres de control que XML no admite.
// Los nombres y conceptos vienen de XML de terceros.
const xml = (t: string) =>
  t
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Fecha AAAA-MM-DD como número de serie de Excel (días desde el 30 de diciembre de 1899).
const serieFecha = (fecha: string) => {
  const [a, m, d] = fecha.split("-").map(Number);
  return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
};

function celdaXml(c: Celda, ref: string): string {
  const s = ESTILOS.indexOf(c.estilo ?? "normal");
  const estilo = s > 0 ? ` s="${s}"` : "";
  if (c.formula) {
    const valor = typeof c.v === "number" && Number.isFinite(c.v) ? `<v>${c.v}</v>` : "";
    return `<c r="${ref}"${estilo}><f>${xml(c.formula)}</f>${valor}</c>`;
  }
  if (c.v === null || c.v === "") return estilo ? `<c r="${ref}"${estilo}/>` : "";
  if (typeof c.v === "number") return Number.isFinite(c.v) ? `<c r="${ref}"${estilo}><v>${c.v}</v></c>` : "";
  if (typeof c.v === "object") return `<c r="${ref}"${estilo}><v>${serieFecha(c.v.fecha)}</v></c>`;
  // Texto en línea: Excel nunca lo interpreta como fórmula.
  return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xml(c.v)}</t></is></c>`;
}

function hojaXml(h: Hoja, primera: boolean): string {
  const pane = h.congelarFilas
    ? `<pane ySplit="${h.congelarFilas}" topLeftCell="A${h.congelarFilas + 1}" activePane="bottomLeft" state="frozen"/>` +
      `<selection pane="bottomLeft" activeCell="A${h.congelarFilas + 1}" sqref="A${h.congelarFilas + 1}"/>`
    : "";
  const vista =
    `<sheetView workbookViewId="0"${primera ? ' tabSelected="1"' : ""}${h.sinCuadricula ? ' showGridLines="0"' : ""}>` +
    `${pane}</sheetView>`;
  const cols = h.anchos.map((a, i) => `<col min="${i + 1}" max="${i + 1}" width="${a}" customWidth="1"/>`).join("");
  const filas = h.filas
    .map((fila, i) => {
      const celdas = fila.map((c, j) => celdaXml(c, `${columna(j)}${i + 1}`)).join("");
      return celdas ? `<row r="${i + 1}">${celdas}</row>` : "";
    })
    .join("");
  const filtro = h.filtro ? `<autoFilter ref="A1:${columna(h.filtro.columnas - 1)}${h.filtro.filas}"/>` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews>${vista}</sheetViews><sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${filas}</sheetData>${filtro}` +
    `<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `<pageSetup orientation="landscape"/>` +
    `</worksheet>`
  );
}

const fuente = (extra: string, tam = 11) => `<font>${extra}<sz val="${tam}"/><name val="Calibri"/><family val="2"/></font>`;
const GRIS = `<color rgb="FF4B5563"/>`;

// Estilos del libro. Colores de la aplicación: verde #0E7C66 en encabezados, gris #4B5563 para lo secundario.
const ESTILOS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2">` +
  `<numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00;\\-&quot;$&quot;#,##0.00"/>` +
  `<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>` +
  `</numFmts>` +
  `<fonts count="7">` +
  fuente("") + // 0 normal
  fuente("<b/>") + // 1 negrita
  fuente(`<b/><color rgb="FF111827"/>`, 16) + // 2 título
  fuente(`<b/><color rgb="FFFFFFFF"/>`) + // 3 encabezado
  fuente(GRIS) + // 4 tenue
  fuente(`<b/><color rgb="FF0B6352"/>`, 13) + // 5 sección
  fuente(`<color rgb="FF111827"/>`, 12) + // 6 subtítulo
  `</fonts>` +
  `<fills count="4">` +
  `<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF0E7C66"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE6F4F0"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left/><right/><top style="thin"><color rgb="FF0E7C66"/></top><bottom style="thin"><color rgb="FF0E7C66"/></bottom><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="${ESTILOS.length}">` +
  [
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`, // normal
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>`, // titulo
    `<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/>`, // subtitulo
    `<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>`, // tenue
    `<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>`, // seccion
    `<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>`, // encabezado
    `<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`, // encabezadoDerecha
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`, // moneda
    `<xf numFmtId="164" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`, // monedaTenue
    `<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>`, // monedaTotal
    `<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>`, // total
    `<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`, // entero
    `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>`, // fecha
    `<xf numFmtId="165" fontId="4" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="left"/></xf>`, // fechaTenue
    `<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>`, // tenueDerecha
  ].join("") +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

// Arma el libro: una hoja por elemento, en ese orden. Devuelve los bytes del .xlsx.
export function libroXlsx(hojas: Hoja[]): Uint8Array {
  const tipoHoja = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
  const filtros = hojas
    .map((h, i) =>
      h.filtro
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">` +
          `'${xml(h.nombre)}'!$A$1:$${columna(h.filtro.columnas - 1)}$${h.filtro.filas}</definedName>`
        : "",
    )
    .join("");
  const archivos: Record<string, string> = {
    "[Content_Types].xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${tipoHoja}"/>`).join("") +
      `</Types>`,
    "_rels/.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    "xl/workbook.xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
      hojas.map((h, i) => `<sheet name="${xml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      `</sheets>` +
      (filtros ? `<definedNames>${filtros}</definedNames>` : "") +
      // Que Excel vuelva a calcular las fórmulas (los totales) al abrir.
      `<calcPr calcId="191029" fullCalcOnLoad="1"/>` +
      `</workbook>`,
    "xl/_rels/workbook.xml.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      hojas
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("") +
      `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
    "xl/styles.xml": ESTILOS_XML,
  };
  hojas.forEach((h, i) => (archivos[`xl/worksheets/sheet${i + 1}.xml`] = hojaXml(h, i === 0)));
  return zipSync(Object.fromEntries(Object.entries(archivos).map(([ruta, texto]) => [ruta, strToU8(texto)])));
}
