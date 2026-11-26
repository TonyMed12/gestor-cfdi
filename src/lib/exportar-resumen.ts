// Exportación del resumen de un periodo (RF-42): CSV con el detalle por factura (D1) y libro de Excel con hojas
// Resumen y Detalle (D2). Sin dependencias de Next, para probarla sola (pruebas/exportar-resumen.test.mjs).
// Las cifras salen de calcularResumen, así cuadran con la pantalla del resumen.
import {
  agruparExclusiones,
  calcularResumen,
  motivoExclusion,
  type FacturaResumen,
  type ResumenPeriodo,
} from "./resumen.ts";
import { columna, libroXlsx, type Celda as CeldaXlsx, type Hoja } from "./xlsx.ts";

// Una factura del periodo con los datos que se ven en el detalle.
export type FacturaExportable = FacturaResumen & {
  uuid: string;
  fecha: string; // fecha de emisión guardada en la base (ISO)
  rfcEmisor: string;
  nombreEmisor: string | null;
  rfcReceptor: string;
  nombreReceptor: string | null;
};

export type DatosExportacion = {
  cliente: { razonSocial: string; rfc: string };
  periodo: { mesAnio: string; nombre: string; estado: string };
  resumen: ResumenPeriodo;
  facturas: FacturaExportable[];
  generado: Date;
};

const centavos = (n: number) => Math.round(n * 100);

// Fecha de emisión en hora del centro de México (-06:00), como se asigna el periodo (C1): AAAA-MM-DD.
const fechaMexico = (iso: string) => new Date(new Date(iso).getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);

export const CAMPOS = ["importe", "gastoDeducible", "ivaTrasladado", "ivaAcreditable", "iepsTrasladado", "isrRetenido", "ivaRetenido"] as const;
type Campo = (typeof CAMPOS)[number];
type Aporte = Record<Campo, number>;

const TITULO_CAMPO: Record<Campo, string> = {
  importe: "Importe",
  gastoDeducible: "Gasto deducible",
  ivaTrasladado: "IVA trasladado",
  ivaAcreditable: "IVA acreditable",
  iepsTrasladado: "IEPS",
  isrRetenido: "ISR retenido",
  ivaRetenido: "IVA retenido",
};

// Lo que aporta una factura al resumen: la suma de sus filas, calculada con la misma función que el resumen.
function aporteDe(f: FacturaResumen): Aporte {
  const filas = calcularResumen([f]).filas;
  return Object.fromEntries(CAMPOS.map((c) => [c, filas.reduce((s, r) => s + centavos(r[c]), 0) / 100])) as Aporte;
}

// Tipo de comprobante del SAT, con su clave: "I (Ingreso)". No confundir con si es ingreso o gasto del cliente.
const nombreComprobante: Record<string, string> = {
  I: "I (Ingreso)", E: "E (Egreso, nota de crédito)", P: "P (Pago)", T: "T (Traslado)", N: "N (Nómina)",
};

// Una fila del detalle: una factura del periodo, incluida o fuera del resumen, con lo que aporta si está incluida.
export type FilaDetalle = {
  incluida: boolean;
  motivo: string;
  tipo: "Ingreso" | "Gasto";
  comprobante: string;
  fecha: string; // AAAA-MM-DD
  uuid: string;
  rfcEmisor: string;
  emisor: string;
  rfcReceptor: string;
  receptor: string;
  moneda: string;
  total: number;
  categorias: string;
  conceptos: string;
  aporte?: Aporte;
};

export function filasDetalle(facturas: FacturaExportable[]): FilaDetalle[] {
  return facturas.map((f) => {
    const motivo = motivoExclusion(f);
    return {
      incluida: !motivo,
      motivo: motivo ?? "",
      tipo: f.relacion === "emitida" ? "Ingreso" : "Gasto",
      comprobante: nombreComprobante[f.tipoComprobante] ?? f.tipoComprobante,
      fecha: fechaMexico(f.fecha),
      uuid: f.uuid,
      rfcEmisor: f.rfcEmisor,
      emisor: f.nombreEmisor ?? "",
      rfcReceptor: f.rfcReceptor,
      receptor: f.nombreReceptor ?? "",
      moneda: f.moneda,
      total: f.total,
      categorias: [...new Set(f.conceptos.map((c) => c.categoria ?? "Sin categoría"))].join("; "),
      conceptos: f.conceptos
        .map((c) => `${c.descripcion ?? "Concepto"} [${c.categoria ?? "Sin categoría"}] ${c.importe.toFixed(2)}`)
        .join(" | "),
      aporte: motivo ? undefined : aporteDe(f),
    };
  });
}

// Suma de lo que aportan las incluidas (en centavos, para no acumular errores de redondeo).
export function sumaIncluidas(filas: FilaDetalle[]): Aporte {
  return Object.fromEntries(
    CAMPOS.map((c) => [c, filas.reduce((s, f) => s + (f.aporte ? centavos(f.aporte[c]) : 0), 0) / 100]),
  ) as Aporte;
}

// Columnas del detalle, en el mismo orden en el CSV y en la hoja Detalle.
export const ENCABEZADO_DETALLE = [
  "En el resumen", "Motivo", "Ingreso o gasto", "Tipo de comprobante", "Fecha de emisión", "Folio fiscal",
  "RFC emisor", "Emisor", "RFC receptor", "Receptor", "Moneda", "Total de la factura", "Categorías", "Conceptos",
  ...CAMPOS.map((c) => TITULO_CAMPO[c]),
];
const PRIMERA_CIFRA = ENCABEZADO_DETALLE.indexOf("Importe");

// ---------- CSV (D1) ----------

type CeldaCsv = string | number | null | undefined;

// Excel interpreta como fórmula un texto que empieza con = + - @ (o tabulador/retorno). Los nombres y conceptos
// vienen de XML de terceros, así que a esos textos se les antepone un apóstrofo (inyección de fórmulas en CSV).
const textoSeguro = (t: string) => (/^[=+\-@\t\r]/.test(t) ? `'${t}` : t);

const celdaCsv = (v: CeldaCsv): string => {
  if (v === null || v === undefined) return "";
  // Números con punto decimal y dos decimales, sin símbolo de moneda: Excel los toma como números.
  const texto = typeof v === "number" ? v.toFixed(2) : textoSeguro(v);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

// CSV con BOM (para que Excel lea bien los acentos como UTF-8), comas y saltos de línea CRLF.
export function aCsv(filas: CeldaCsv[][]): string {
  return "﻿" + filas.map((f) => f.map(celdaCsv).join(",")).join("\r\n") + "\r\n";
}

// El CSV es una sola tabla: el encabezado, una fila por factura del periodo y al final el total de las incluidas,
// que cuadra con el resumen. El resumen con formato va en el libro de Excel (D2).
export function filasCsv(d: DatosExportacion): CeldaCsv[][] {
  const detalle = filasDetalle(d.facturas);
  const suma = sumaIncluidas(detalle);
  return [
    ENCABEZADO_DETALLE,
    ...detalle.map((f): CeldaCsv[] => [
      f.incluida ? "Sí" : "No", f.motivo, f.tipo, f.comprobante, f.fecha, f.uuid, f.rfcEmisor, f.emisor,
      f.rfcReceptor, f.receptor, f.moneda, f.total, f.categorias, f.conceptos, ...CAMPOS.map((c) => f.aporte?.[c]),
    ]),
    ["Total de las incluidas", ...Array<CeldaCsv>(PRIMERA_CIFRA - 1).fill(""), ...CAMPOS.map((c) => suma[c])],
  ];
}

// ---------- Excel (D2) ----------

const texto = (v: string, estilo?: CeldaXlsx["estilo"]): CeldaXlsx => ({ v, estilo });
const pesos = (v: number, estilo: CeldaXlsx["estilo"] = "moneda"): CeldaXlsx => ({ v, estilo });

// Hoja «Resumen»: encabezado del cliente y periodo, totales, resumen por categoría y facturas fuera por motivo.
function hojaResumen(d: DatosExportacion): Hoja {
  const { resumen } = d;
  const t = resumen.totales;
  const hayIeps = resumen.filas.some((f) => f.iepsTrasladado !== 0);
  const cifras = CAMPOS.filter((c) => c !== "iepsTrasladado" || hayIeps);
  const filas: CeldaXlsx[][] = [
    [texto(`Resumen del periodo · ${d.periodo.nombre}`, "titulo")],
    [texto(`${d.cliente.razonSocial} · RFC ${d.cliente.rfc}`, "subtitulo")],
    [texto(
      `Periodo ${d.periodo.estado === "abierto" ? "abierto" : "cerrado"} · Generado el ${d.generado.toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`,
      "tenue",
    )],
    [texto(
      `${d.facturas.length} facturas en el periodo = ${resumen.incluidas} incluidas + ${resumen.excluidas.length} fuera del resumen. Solo cuentan las facturas aprobadas que no están canceladas.`,
      "tenue",
    )],
    [],
    [texto("Totales", "encabezado"), texto("Importe (MXN)", "encabezadoDerecha")],
    [texto("Ingresos"), pesos(t.ingresos)],
    [texto("Gastos"), pesos(t.gastos)],
    [texto("Gastos deducibles"), pesos(t.gastosDeducibles)],
    [texto("IVA trasladado"), pesos(t.ivaTrasladado)],
    [texto("IVA acreditable"), pesos(t.ivaAcreditable)],
    [texto("Retenciones a favor"), pesos(t.retencionesAFavor)],
    [texto("Retenciones por enterar"), pesos(t.retencionesPorEnterar)],
  ];
  if (resumen.ajusteNoDesglosado.facturas > 0) {
    filas.push([
      texto("Diferencia no desglosada", "tenue"),
      pesos(resumen.ajusteNoDesglosado.importe, "monedaTenue"),
      texto(`En ${resumen.ajusteNoDesglosado.facturas} factura(s) el total no coincide con sus conceptos e impuestos (descuentos o impuestos locales). No está en las cifras de arriba.`, "tenue"),
    ]);
  }

  filas.push(
    [],
    [texto("Por categoría", "seccion")],
    [
      texto("Tipo", "encabezado"), texto("Categoría", "encabezado"), texto("Facturas", "encabezadoDerecha"),
      ...cifras.map((c) => texto(TITULO_CAMPO[c], "encabezadoDerecha")),
    ],
  );
  if (resumen.filas.length === 0) filas.push([texto("Aún no hay facturas aprobadas en este periodo.", "tenue")]);
  for (const f of resumen.filas) {
    filas.push([
      texto(f.tipo), texto(f.categoria), { v: f.facturas, estilo: "entero" },
      ...cifras.map((c) =>
        (c === "gastoDeducible" || c === "ivaAcreditable") && f.tipo === "Ingreso" ? texto("—", "tenueDerecha") : pesos(f[c]),
      ),
    ]);
  }

  const grupos = agruparExclusiones(resumen.excluidas);
  filas.push([], [texto(`Fuera del resumen · ${resumen.excluidas.length} de ${d.facturas.length}`, "seccion")]);
  if (grupos.length === 0) {
    filas.push([texto("Todas las facturas del periodo están incluidas.", "tenue")]);
  } else {
    filas.push([texto("Motivo", "encabezado"), texto("Facturas", "encabezadoDerecha")]);
    for (const g of grupos) filas.push([texto(g.motivo), { v: g.facturas.length, estilo: "entero" }]);
    filas.push([texto("El detalle de cada factura está en la hoja «Detalle».", "tenue")]);
  }

  return {
    nombre: "Resumen",
    // A: etiquetas y tipo; B: categoría; luego las cifras.
    anchos: [26, 40, 16, ...cifras.map(() => 17)],
    filas,
    sinCuadricula: true,
  };
}

// Hoja «Detalle»: una tabla con filtros, una fila por factura y el total de las incluidas con una fórmula SUMA.
function hojaDetalle(d: DatosExportacion): Hoja {
  const detalle = filasDetalle(d.facturas);
  const suma = sumaIncluidas(detalle);
  const filas: CeldaXlsx[][] = [
    ENCABEZADO_DETALLE.map((t, i) => texto(t, i >= PRIMERA_CIFRA || t === "Total de la factura" ? "encabezadoDerecha" : "encabezado")),
  ];
  for (const f of detalle) {
    // Las de fuera del resumen van en gris: se ven, pero no suman.
    const g = f.incluida ? "" : "Tenue";
    const t = (v: string) => texto(v, f.incluida ? undefined : "tenue");
    filas.push([
      t(f.incluida ? "Sí" : "No"), t(f.motivo), t(f.tipo), t(f.comprobante),
      { v: { fecha: f.fecha }, estilo: f.incluida ? "fecha" : "fechaTenue" },
      t(f.uuid), t(f.rfcEmisor), t(f.emisor), t(f.rfcReceptor), t(f.receptor), t(f.moneda),
      pesos(f.total, `moneda${g}` as CeldaXlsx["estilo"]),
      t(f.categorias), t(f.conceptos),
      ...CAMPOS.map((c) => (f.aporte ? pesos(f.aporte[c]) : { v: null })),
    ]);
  }
  const ultima = detalle.length + 1;
  filas.push([
    texto("Total de las incluidas", "total"),
    ...Array.from({ length: PRIMERA_CIFRA - 1 }, () => texto("", "total")),
    // La suma la calcula Excel; las de fuera del resumen no tienen cifras, así que no cuentan.
    ...CAMPOS.map((c, i) => ({
      v: suma[c],
      formula: ultima > 1 ? `SUM(${columna(PRIMERA_CIFRA + i)}2:${columna(PRIMERA_CIFRA + i)}${ultima})` : undefined,
      estilo: "monedaTotal" as const,
    })),
  ]);

  return {
    nombre: "Detalle",
    anchos: [13, 30, 15, 24, 15, 40, 16, 36, 16, 36, 9, 18, 34, 70, ...CAMPOS.map(() => 16)],
    filas,
    congelarFilas: 1,
    filtro: { columnas: ENCABEZADO_DETALLE.length, filas: detalle.length + 1 },
  };
}

export function libroResumen(d: DatosExportacion): Uint8Array {
  return libroXlsx([hojaResumen(d), hojaDetalle(d)]);
}

// Nombre del archivo: resumen-<RFC>-<AAAA-MM>.<ext>, solo con letras y dígitos ASCII (va en una cabecera HTTP).
export const nombreArchivo = (rfc: string, mesAnio: string, extension: "csv" | "xlsx" = "csv") =>
  `resumen-${rfc.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${mesAnio.replace(/[^0-9-]/g, "")}.${extension}`;
