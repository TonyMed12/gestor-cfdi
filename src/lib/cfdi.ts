import { XMLParser } from "fast-xml-parser";

export type ImpuestoLeido = {
  tipo: "trasladado" | "retenido";
  impuesto: "IVA" | "ISR" | "IEPS";
  tasa: number;
  importe: string;
};

export type ConceptoLeido = {
  clave_prod_serv: string;
  descripcion: string;
  cantidad: string;
  unidad: string | null;
  importe: string;
  objeto_impuesto: string | null;
  impuestos: ImpuestoLeido[];
};

export type FacturaLeida = {
  uuid_fiscal: string;
  tipo_comprobante: string;
  rfc_emisor: string;
  nombre_emisor: string | null;
  rfc_receptor: string;
  nombre_receptor: string | null;
  uso_cfdi: string;
  forma_pago: string | null;
  metodo_pago: "PUE" | "PPD" | null;
  subtotal: string;
  total: string;
  moneda: string;
  emitido_en: string;
  timbrado_en: string;
  sello: string | null; // solo sirve para consultar al SAT; no se guarda
};

// exclusion: motivo por el que la factura se guarda pero queda fuera de los resúmenes (RF-40).
export type CfdiLeido = { factura: FacturaLeida; conceptos: ConceptoLeido[]; exclusion: string | null };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (nombre) => ["Concepto", "Traslado", "Retencion"].includes(nombre),
});

const hijo = (nodo: unknown, clave: string): unknown => (nodo as Record<string, unknown> | undefined)?.[clave];
const attr = (nodo: unknown, clave: string): string | undefined => {
  const v = hijo(nodo, `@_${clave}`);
  return typeof v === "string" && v !== "" ? v : undefined;
};
const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : x === undefined ? [] : [x]);

const DINERO = /^\d+(\.\d+)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const MONEDA = /^[A-Z]{3}$/;
const IMPUESTOS = { "001": "ISR", "002": "IVA", "003": "IEPS" } as const;
const centavos = (s: string) => Math.round(Number(s) * 100);

// shortcut: las fechas del CFDI son locales del lugar de expedición; se toman como hora del centro de México (-06:00).
const aFecha = (s: string) => `${s}-06:00`;

export function leerCfdi(xml: string): CfdiLeido | { error: string } {
  let raiz: unknown;
  try {
    raiz = parser.parse(xml);
  } catch {
    return { error: "El archivo no es un XML válido" };
  }
  const c = hijo(raiz, "Comprobante");
  if (!c) return { error: "No es un CFDI: no tiene el nodo Comprobante" };

  const version = attr(c, "Version") ?? attr(c, "version");
  if (version !== "4.0") {
    return { error: `Solo se aceptan CFDI 4.0 (este es ${version ? `versión ${version}` : "de versión desconocida"})` };
  }
  const faltantes = ["Fecha", "SubTotal", "Total", "Moneda", "TipoDeComprobante"].filter((k) => !attr(c, k));
  if (faltantes.length) return { error: `Faltan datos del comprobante: ${faltantes.join(", ")}` };

  const tipo = attr(c, "TipoDeComprobante")!;
  if (!["I", "E", "T", "P", "N"].includes(tipo)) return { error: `Tipo de comprobante desconocido: ${tipo}` };
  const subtotal = attr(c, "SubTotal")!;
  const total = attr(c, "Total")!;
  const descuento = attr(c, "Descuento") ?? "0";
  for (const dinero of [subtotal, total, descuento]) {
    if (!DINERO.test(dinero)) return { error: `Importe con formato inválido: ${dinero}` };
  }
  const moneda = attr(c, "Moneda")!;
  const fecha = attr(c, "Fecha")!;
  // La moneda es una clave del catálogo c_Moneda del SAT (ISO 4217): tres letras mayúsculas.
  if (!MONEDA.test(moneda) || !FECHA.test(fecha)) return { error: "Moneda o fecha del comprobante con formato inválido" };

  const timbre = lista(hijo(c, "Complemento")).map((x) => hijo(x, "TimbreFiscalDigital")).find(Boolean);
  const uuid = attr(timbre, "UUID");
  const fechaTimbrado = attr(timbre, "FechaTimbrado");
  if (!uuid || !fechaTimbrado) return { error: "El CFDI no está timbrado (no tiene Timbre Fiscal Digital)" };
  if (!UUID.test(uuid) || !FECHA.test(fechaTimbrado)) return { error: "El timbre tiene un UUID o una fecha inválidos" };

  const emisor = hijo(c, "Emisor");
  const receptor = hijo(c, "Receptor");
  const rfcEmisor = attr(emisor, "Rfc");
  const rfcReceptor = attr(receptor, "Rfc");
  const uso = attr(receptor, "UsoCFDI");
  if (!rfcEmisor || !rfcReceptor || !uso) return { error: "Faltan el RFC del emisor, el del receptor o el uso del CFDI" };
  if (rfcEmisor.length > 13 || rfcReceptor.length > 13 || uso.length > 4) return { error: "RFC o uso del CFDI con longitud inválida" };

  const nodosConcepto = lista(hijo(hijo(c, "Conceptos"), "Concepto"));
  if (nodosConcepto.length === 0) return { error: "El CFDI no tiene conceptos" };

  const conceptos: ConceptoLeido[] = [];
  let sumaImportes = 0;
  let trasladados = 0;
  let retenidos = 0;
  for (const nodo of nodosConcepto) {
    const clave = attr(nodo, "ClaveProdServ");
    const descripcion = attr(nodo, "Descripcion");
    const cantidad = attr(nodo, "Cantidad");
    const importe = attr(nodo, "Importe");
    if (!clave || !descripcion || !cantidad || !importe) {
      return { error: "Un concepto no trae clave, descripción, cantidad o importe" };
    }
    if (clave.length > 8 || !DINERO.test(cantidad) || !DINERO.test(importe)) {
      return { error: `Concepto con datos inválidos: ${descripcion.slice(0, 40)}` };
    }
    sumaImportes += centavos(importe);

    const impuestos: ImpuestoLeido[] = [];
    const bloque = hijo(nodo, "Impuestos");
    const grupos = [
      { tipo: "trasladado", nodos: lista(hijo(hijo(bloque, "Traslados"), "Traslado")) },
      { tipo: "retenido", nodos: lista(hijo(hijo(bloque, "Retenciones"), "Retencion")) },
    ] as const;
    for (const grupo of grupos) {
      for (const imp of grupo.nodos) {
        if (attr(imp, "TipoFactor") === "Exento") continue; // el exento no lleva tasa ni importe
        const codigo = attr(imp, "Impuesto");
        const nombre = codigo && codigo in IMPUESTOS ? IMPUESTOS[codigo as keyof typeof IMPUESTOS] : undefined;
        const tasa = attr(imp, "TasaOCuota");
        const impImporte = attr(imp, "Importe");
        if (!nombre || !tasa || !impImporte || !DINERO.test(tasa) || !DINERO.test(impImporte)) {
          return { error: `Impuesto inválido en el concepto: ${descripcion.slice(0, 40)}` };
        }
        if (Number(tasa) >= 100) return { error: "Cuota de impuesto fuera de rango (no soportada todavía)" };
        impuestos.push({ tipo: grupo.tipo, impuesto: nombre, tasa: Number(tasa), importe: impImporte });
        if (grupo.tipo === "trasladado") trasladados += centavos(impImporte);
        else retenidos += centavos(impImporte);
      }
    }
    conceptos.push({
      clave_prod_serv: clave,
      descripcion,
      cantidad,
      unidad: attr(nodo, "Unidad") ?? attr(nodo, "ClaveUnidad") ?? null,
      importe,
      objeto_impuesto: attr(nodo, "ObjetoImp") ?? null,
      impuestos,
    });
  }

  // Si el comprobante trae los totales globales de impuestos, se usan esos; si no, la suma de los conceptos.
  const global = hijo(c, "Impuestos");
  const totalTrasladado = attr(global, "TotalImpuestosTrasladados");
  const totalRetenido = attr(global, "TotalImpuestosRetenidos");
  // Impuestos locales (por ejemplo, una retención cedular): también forman parte del total.
  const locales = lista(hijo(c, "Complemento")).map((x) => hijo(x, "ImpuestosLocales")).find(Boolean);
  const localTrasladado = attr(locales, "TotaldeTraslados") ?? "0";
  const localRetenido = attr(locales, "TotaldeRetenciones") ?? "0";
  for (const dinero of [totalTrasladado, totalRetenido, localTrasladado, localRetenido]) {
    if (dinero !== undefined && !DINERO.test(dinero)) return { error: `Total de impuestos con formato inválido: ${dinero}` };
  }
  if (totalTrasladado !== undefined) trasladados = centavos(totalTrasladado);
  if (totalRetenido !== undefined) retenidos = centavos(totalRetenido);

  // RF-20: los conceptos y los impuestos deben sumar el total (con tolerancia de redondeo de 1 centavo por concepto).
  const tolerancia = conceptos.length + 1;
  const calculado = centavos(subtotal) - centavos(descuento) + trasladados - retenidos + centavos(localTrasladado) - centavos(localRetenido);
  let exclusion: string | null = null;
  if (Math.abs(sumaImportes - centavos(subtotal)) > tolerancia) {
    exclusion = "Los conceptos no suman el subtotal";
  } else if (Math.abs(calculado - centavos(total)) > tolerancia) {
    exclusion = "Los importes y los impuestos no suman el total";
  }

  const metodo = attr(c, "MetodoPago");
  return {
    factura: {
      uuid_fiscal: uuid.toUpperCase(),
      tipo_comprobante: tipo,
      rfc_emisor: rfcEmisor,
      nombre_emisor: attr(emisor, "Nombre") ?? null,
      rfc_receptor: rfcReceptor,
      nombre_receptor: attr(receptor, "Nombre") ?? null,
      uso_cfdi: uso,
      forma_pago: attr(c, "FormaPago") ?? null,
      metodo_pago: metodo === "PUE" || metodo === "PPD" ? metodo : null,
      subtotal,
      total,
      moneda,
      emitido_en: aFecha(fecha),
      timbrado_en: aFecha(fechaTimbrado),
      sello: attr(c, "Sello") ?? null,
    },
    conceptos,
    exclusion,
  };
}

// ---------- Resumen para mostrar en pantalla ----------
// A diferencia de leerCfdi, no rechaza nada: muestra lo que el XML traiga, aunque esté incompleto.

export type DetalleCfdi = {
  version: string | null;
  tipo: string | null;
  timbrado: boolean;
  serie: string | null;
  folio: string | null;
  fecha: string | null;
  lugarExpedicion: string | null;
  moneda: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  subtotal: string | null;
  descuento: string | null;
  total: string | null;
  traslados: { impuesto: string; importe: string }[];
  retenciones: { impuesto: string; importe: string }[];
  locales: { tipo: "traslado" | "retención"; nombre: string; importe: string }[];
  emisor: { rfc: string | null; nombre: string | null; regimen: string | null };
  receptor: { rfc: string | null; nombre: string | null; uso: string | null; codigoPostal: string | null; regimen: string | null };
  uuid: string | null;
  fechaTimbrado: string | null;
  conceptos: {
    clave: string | null;
    descripcion: string | null;
    cantidad: string | null;
    valorUnitario: string | null;
    importe: string | null;
    claveUnidad: string | null;
    unidad: string | null;
    impuestos: { tipo: "trasladado" | "retenido"; impuesto: string; tasa: string | null; importe: string }[];
  }[];
};

const nombreImpuesto = (codigo: string | undefined) =>
  codigo && codigo in IMPUESTOS ? IMPUESTOS[codigo as keyof typeof IMPUESTOS] : (codigo ?? "Impuesto");
const dinero = (s: string | undefined) => (s !== undefined && DINERO.test(s) ? s : null);

// Suma por tipo de impuesto (IVA, ISR, IEPS) con aritmética en centavos.
function agrupar(nodos: { impuesto: string; importe: string }[]) {
  const suma = new Map<string, number>();
  for (const n of nodos) suma.set(n.impuesto, (suma.get(n.impuesto) ?? 0) + centavos(n.importe));
  return Array.from(suma, ([impuesto, cents]) => ({ impuesto, importe: (cents / 100).toFixed(2) }));
}

export function detalleCfdi(xml: string): DetalleCfdi | { error: string } {
  let raiz: unknown;
  try {
    raiz = parser.parse(xml);
  } catch {
    return { error: "El archivo no es un XML válido" };
  }
  const c = hijo(raiz, "Comprobante");
  if (!c) return { error: "No es un CFDI: no tiene el nodo Comprobante" };

  const emisor = hijo(c, "Emisor");
  const receptor = hijo(c, "Receptor");
  const complementos = lista(hijo(c, "Complemento"));
  const timbre = complementos.map((x) => hijo(x, "TimbreFiscalDigital")).find(Boolean);
  const locales = complementos.map((x) => hijo(x, "ImpuestosLocales")).find(Boolean);

  const conceptos = lista(hijo(hijo(c, "Conceptos"), "Concepto")).map((nodo) => {
    const bloque = hijo(nodo, "Impuestos");
    const impuestos = [
      ...lista(hijo(hijo(bloque, "Traslados"), "Traslado")).map((n) => ({ tipo: "trasladado" as const, n })),
      ...lista(hijo(hijo(bloque, "Retenciones"), "Retencion")).map((n) => ({ tipo: "retenido" as const, n })),
    ]
      .filter(({ n }) => attr(n, "TipoFactor") !== "Exento" && dinero(attr(n, "Importe")))
      .map(({ tipo, n }) => ({
        tipo,
        impuesto: nombreImpuesto(attr(n, "Impuesto")),
        tasa: attr(n, "TasaOCuota") ?? null,
        importe: attr(n, "Importe")!,
      }));
    return {
      clave: attr(nodo, "ClaveProdServ") ?? null,
      descripcion: attr(nodo, "Descripcion") ?? null,
      cantidad: attr(nodo, "Cantidad") ?? null,
      valorUnitario: attr(nodo, "ValorUnitario") ?? null,
      importe: attr(nodo, "Importe") ?? null,
      claveUnidad: attr(nodo, "ClaveUnidad") ?? null,
      unidad: attr(nodo, "Unidad") ?? null,
      impuestos,
    };
  });

  // Totales de impuestos: los del comprobante si vienen; si no, la suma de los conceptos.
  const global = hijo(c, "Impuestos");
  const globales = (nodos: unknown[]) =>
    nodos.flatMap((n) => {
      const importe = dinero(attr(n, "Importe"));
      return importe ? [{ impuesto: nombreImpuesto(attr(n, "Impuesto")), importe }] : [];
    });
  let traslados = agrupar(globales(lista(hijo(hijo(global, "Traslados"), "Traslado"))));
  let retenciones = agrupar(globales(lista(hijo(hijo(global, "Retenciones"), "Retencion"))));
  if (traslados.length === 0 && retenciones.length === 0) {
    const todos = conceptos.flatMap((k) => k.impuestos);
    traslados = agrupar(todos.filter((i) => i.tipo === "trasladado"));
    retenciones = agrupar(todos.filter((i) => i.tipo === "retenido"));
  }

  return {
    version: attr(c, "Version") ?? attr(c, "version") ?? null,
    tipo: attr(c, "TipoDeComprobante") ?? null,
    timbrado: Boolean(attr(timbre, "UUID")),
    serie: attr(c, "Serie") ?? null,
    folio: attr(c, "Folio") ?? null,
    fecha: attr(c, "Fecha") ?? null,
    lugarExpedicion: attr(c, "LugarExpedicion") ?? null,
    moneda: attr(c, "Moneda") ?? null,
    metodoPago: attr(c, "MetodoPago") ?? null,
    formaPago: attr(c, "FormaPago") ?? null,
    subtotal: dinero(attr(c, "SubTotal")),
    descuento: dinero(attr(c, "Descuento")),
    total: dinero(attr(c, "Total")),
    traslados,
    retenciones,
    locales: [
      ...lista(hijo(locales, "TrasladosLocales")).map((n) => ({ tipo: "traslado" as const, nombre: attr(n, "ImpLocTrasladado") ?? "Impuesto local", importe: dinero(attr(n, "Importe")) })),
      ...lista(hijo(locales, "RetencionesLocales")).map((n) => ({ tipo: "retención" as const, nombre: attr(n, "ImpLocRetenido") ?? "Impuesto local", importe: dinero(attr(n, "Importe")) })),
    ].flatMap((l) => (l.importe ? [{ ...l, importe: l.importe }] : [])),
    emisor: { rfc: attr(emisor, "Rfc") ?? null, nombre: attr(emisor, "Nombre") ?? null, regimen: attr(emisor, "RegimenFiscal") ?? null },
    receptor: {
      rfc: attr(receptor, "Rfc") ?? null,
      nombre: attr(receptor, "Nombre") ?? null,
      uso: attr(receptor, "UsoCFDI") ?? null,
      codigoPostal: attr(receptor, "DomicilioFiscalReceptor") ?? null,
      regimen: attr(receptor, "RegimenFiscalReceptor") ?? null,
    },
    uuid: attr(timbre, "UUID") ?? null,
    fechaTimbrado: attr(timbre, "FechaTimbrado") ?? null,
    conceptos,
  };
}
