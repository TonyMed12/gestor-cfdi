// Resumen de un cliente en un periodo (C3, RF-39): ingresos, gastos, IVA y retenciones por categoría.
// Se prueba solo (pruebas/resumen.test.mjs). Todo se suma en centavos.
// La extensión .ts permite correr las pruebas con node sin compilar (tsconfig: allowImportingTsExtensions).
import { ivaAcreditable, type ImpuestoIva } from "./iva.ts";

export type ImpuestoResumen = ImpuestoIva;
export type ConceptoResumen = {
  importe: number;
  categoria: string | null;
  // Ya resuelta con esDeducible (src/lib/deducibilidad.ts, A7): la marca de la factura gana sobre la de la categoría.
  deducible: boolean;
  impuestos: ImpuestoResumen[];
};
export type FacturaResumen = {
  id: string;
  tipoComprobante: string; // I, E, P, N, T
  relacion: "emitida" | "recibida";
  moneda: string;
  estadoRevision: string;
  estadoSat: string | null;
  motivoExclusion: string | null;
  total: number;
  conceptos: ConceptoResumen[];
};

export type FilaResumen = {
  tipo: "Ingreso" | "Gasto";
  categoria: string;
  facturas: number;
  importe: number;
  gastoDeducible: number; // parte del importe que es deducible (solo gastos, A7)
  ivaTrasladado: number;
  ivaAcreditable: number;
  iepsTrasladado: number;
  isrRetenido: number;
  ivaRetenido: number;
};

export type Exclusion = { id: string; motivo: string };

export type GrupoExclusion<T extends Exclusion = Exclusion> = { motivo: string; facturas: T[] };

// Facturas fuera del resumen agrupadas por motivo (C5, RF-40): de más a menos facturas y, si empatan, por motivo.
export function agruparExclusiones<T extends Exclusion>(excluidas: T[]): GrupoExclusion<T>[] {
  const grupos = new Map<string, T[]>();
  for (const e of excluidas) grupos.set(e.motivo, [...(grupos.get(e.motivo) ?? []), e]);
  return [...grupos]
    .map(([motivo, facturas]) => ({ motivo, facturas }))
    .sort((a, b) => b.facturas.length - a.facturas.length || a.motivo.localeCompare(b.motivo, "es"));
}

// ¿Las incluidas más las de fuera suman todas las facturas del periodo? (C5: "el número cuadra").
export const cuadraConPeriodo = (incluidas: number, excluidas: number, facturasDelPeriodo: number): boolean =>
  incluidas + excluidas === facturasDelPeriodo;

export type ResumenPeriodo = {
  filas: FilaResumen[];
  totales: {
    ingresos: number;
    gastos: number;
    gastosDeducibles: number; // gastos de conceptos deducibles (marca de la factura o de la categoría, A7)
    ivaTrasladado: number; // IVA cobrado en ingresos
    ivaAcreditable: number; // IVA de gastos deducibles
    retencionesAFavor: number; // ISR e IVA que le retuvieron al cliente (en sus ingresos)
    retencionesPorEnterar: number; // ISR e IVA que retuvo el cliente (en sus gastos)
  };
  // Diferencia entre el total de la factura y sus conceptos e impuestos guardados: descuentos o impuestos
  // locales (por ejemplo, la retención cedular), que hoy no se guardan por concepto.
  ajusteNoDesglosado: { importe: number; facturas: number };
  incluidas: number;
  excluidas: Exclusion[];
};

const centavos = (n: number) => Math.round(n * 100);
const pesos = (c: number) => c / 100;

const TIPOS_SIN_RESUMEN: Record<string, string> = {
  P: "Comprobante de pago: el importe ya está en la factura que paga",
  T: "Comprobante de traslado: no tiene valor fiscal",
  N: "Recibo de nómina: aún no se incluye en el resumen",
};

// Por qué una factura no entra al resumen (RN-01, RN-05, RN-06), o null si entra.
// Solo entran las aprobadas, vigentes o sin consultar, de ingreso o egreso y en pesos.
// Un UUID solo existe una vez por cliente (RN-02): la base lo impide, así que no hay duplicadas que quitar aquí.
export function motivoExclusion(f: FacturaResumen): string | null {
  if (f.estadoRevision === "excluido") return f.motivoExclusion ? `Excluida: ${f.motivoExclusion}` : "Excluida";
  if (f.estadoSat === "cancelada") return "Cancelada ante el SAT";
  if (f.estadoRevision === "por_confirmar") return "Por confirmar";
  if (f.estadoRevision !== "clasificado") return "Pendiente de aprobar";
  if (TIPOS_SIN_RESUMEN[f.tipoComprobante]) return TIPOS_SIN_RESUMEN[f.tipoComprobante];
  if (f.moneda !== "MXN") return `En ${f.moneda}: falta el tipo de cambio`;
  return null;
}

type Acumulado = Omit<FilaResumen, "facturas"> & { ids: Set<string> };

export function calcularResumen(facturas: FacturaResumen[]): ResumenPeriodo {
  const filas = new Map<string, Acumulado>();
  const excluidas: Exclusion[] = [];
  let ajuste = 0;
  let conAjuste = 0;
  let incluidas = 0;

  for (const f of facturas) {
    const motivo = motivoExclusion(f);
    if (motivo) {
      excluidas.push({ id: f.id, motivo });
      continue;
    }
    incluidas++;
    // Una nota de crédito (egreso) resta de los ingresos o de los gastos.
    const signo = f.tipoComprobante === "E" ? -1 : 1;
    const tipo = f.relacion === "emitida" ? "Ingreso" : "Gasto";
    let desglosado = 0;

    for (const c of f.conceptos) {
      const categoria = c.categoria ?? "Sin categoría";
      const clave = `${tipo}|${categoria}`;
      const fila: Acumulado = filas.get(clave) ?? {
        tipo, categoria, importe: 0, gastoDeducible: 0, ivaTrasladado: 0, ivaAcreditable: 0, iepsTrasladado: 0,
        isrRetenido: 0, ivaRetenido: 0, ids: new Set<string>(),
      };
      fila.ids.add(f.id);
      fila.importe += signo * centavos(c.importe);
      if (tipo === "Gasto" && c.deducible) fila.gastoDeducible += signo * centavos(c.importe);
      desglosado += centavos(c.importe);

      for (const i of c.impuestos) {
        const monto = centavos(i.importe);
        if (i.tipo === "trasladado") {
          desglosado += monto;
          if (i.impuesto === "IVA") {
            fila.ivaTrasladado += signo * monto;
            // Regla única del IVA acreditable (C4): recibida, deducible y a tasa válida.
            const acreditable = ivaAcreditable({ relacion: f.relacion, deducible: c.deducible, impuesto: i });
            fila.ivaAcreditable += signo * centavos(acreditable.importe);
          } else if (i.impuesto === "IEPS") {
            fila.iepsTrasladado += signo * monto;
          }
        } else {
          desglosado -= monto;
          if (i.impuesto === "ISR") fila.isrRetenido += signo * monto;
          else if (i.impuesto === "IVA") fila.ivaRetenido += signo * monto;
        }
      }
      filas.set(clave, fila);
    }

    // Tolerancia de redondeo: un centavo por concepto más uno, como al validar el XML (cfdi.ts).
    const diferencia = centavos(f.total) - desglosado;
    if (Math.abs(diferencia) > f.conceptos.length + 1) {
      ajuste += signo * diferencia;
      conAjuste++;
    }
  }

  const lista = [...filas.values()];
  const suma = (tipo: "Ingreso" | "Gasto", campo: keyof Omit<FilaResumen, "tipo" | "categoria" | "facturas">) =>
    lista.filter((r) => r.tipo === tipo).reduce((s, r) => s + r[campo], 0);

  return {
    filas: lista
      // Primero los ingresos y luego los gastos; dentro de cada uno, de mayor a menor importe.
      .sort((a, b) => (a.tipo === b.tipo ? b.importe - a.importe : a.tipo === "Ingreso" ? -1 : 1))
      .map(({ ids, ...r }) => ({
        ...r,
        facturas: ids.size,
        importe: pesos(r.importe),
        gastoDeducible: pesos(r.gastoDeducible),
        ivaTrasladado: pesos(r.ivaTrasladado),
        ivaAcreditable: pesos(r.ivaAcreditable),
        iepsTrasladado: pesos(r.iepsTrasladado),
        isrRetenido: pesos(r.isrRetenido),
        ivaRetenido: pesos(r.ivaRetenido),
      })),
    totales: {
      ingresos: pesos(suma("Ingreso", "importe")),
      gastos: pesos(suma("Gasto", "importe")),
      gastosDeducibles: pesos(suma("Gasto", "gastoDeducible")),
      ivaTrasladado: pesos(suma("Ingreso", "ivaTrasladado")),
      ivaAcreditable: pesos(suma("Gasto", "ivaAcreditable")),
      retencionesAFavor: pesos(suma("Ingreso", "isrRetenido") + suma("Ingreso", "ivaRetenido")),
      retencionesPorEnterar: pesos(suma("Gasto", "isrRetenido") + suma("Gasto", "ivaRetenido")),
    },
    ajusteNoDesglosado: { importe: pesos(ajuste), facturas: conAjuste },
    incluidas,
    excluidas,
  };
}

export type TipoFila = FilaResumen["tipo"];

// Lo que aporta una factura a una fila del resumen (C10).
export type AporteFactura = { id: string } & Omit<FilaResumen, "tipo" | "categoria" | "facturas">;

// Facturas que componen una fila del resumen (C10): las incluidas que tienen conceptos de esa categoría, con lo que
// aporta cada una. Se calcula con calcularResumen factura por factura, así las cifras son las mismas que las de la
// fila (las notas de crédito restan) y la suma de los aportes da el total de la fila.
export function facturasDeCategoria(facturas: FacturaResumen[], tipo: TipoFila, categoria: string): AporteFactura[] {
  const aportes: AporteFactura[] = [];
  for (const f of facturas) {
    const fila = calcularResumen([f]).filas.find((r) => r.tipo === tipo && r.categoria === categoria);
    if (!fila) continue; // no entra al resumen o no tiene conceptos de esa categoría
    aportes.push({
      id: f.id,
      importe: fila.importe,
      gastoDeducible: fila.gastoDeducible,
      ivaTrasladado: fila.ivaTrasladado,
      ivaAcreditable: fila.ivaAcreditable,
      iepsTrasladado: fila.iepsTrasladado,
      isrRetenido: fila.isrRetenido,
      ivaRetenido: fila.ivaRetenido,
    });
  }
  return aportes;
}
