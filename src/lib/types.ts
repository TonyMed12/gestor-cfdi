// Tipos del dominio de la aplicación.

export type EstadoArchivo =
  | "recibido"
  | "leyendo"
  | "por_revisar"
  | "clasificado"
  | "error";

export type EstadoSat = "vigente" | "cancelada" | "no_encontrada";

export type EstadoRevision =
  | "por_confirmar"
  | "por_revisar"
  | "clasificado"
  | "excluido";

export type OrigenClasificacion = "ia" | "regla";

export interface Cliente {
  id: string;
  razonSocial: string;
  rfc: string;
  sinLeer: number;
  porRevisar: number;
  conError: number;
  faltantes: number;
}

export interface Impuesto {
  tipo: "trasladado" | "retenido";
  impuesto: "IVA" | "ISR" | "IEPS";
  tasa: number;
  importe: number;
}

export interface Concepto {
  claveProdServ: string;
  descripcion: string;
  cantidad: number;
  importe: number;
  impuestos: Impuesto[];
}

export interface Sugerencia {
  modelo: string;
  versionModelo: string;
  confianza: number;
  categoriaSugerida: string;
  deducible: boolean;
  ivaAcreditable: number;
  retenciones: string;
  explicacion: string;
  camposUsados: string[];
}

export interface Factura {
  id: string;
  clienteId: string;
  uuidFiscal: string;
  tipoComprobante: "I" | "E" | "T" | "P" | "N";
  relacion: "emitida" | "recibida";
  emisorNombre: string;
  emisorRfc: string;
  receptorNombre: string;
  receptorRfc: string;
  usoCfdi: string;
  formaPago: string;
  metodoPago: "PUE" | "PPD";
  moneda: string;
  subtotal: number;
  total: number;
  fechaEmision: string;
  fechaTimbrado: string;
  fechaConsultaSat: string;
  estadoSat: EstadoSat;
  estadoRevision: EstadoRevision;
  motivoExclusion?: string;
  prioridad: "alta" | "normal";
  motivoPrioridad?: string;
  categoriaPropuesta: string;
  origenClasificacion: OrigenClasificacion;
  conceptos: Concepto[];
  sugerencia?: Sugerencia;
  emisorNuevo?: boolean;
  decidida?: boolean;
  decididaPor?: string;
  decididaEn?: string;
}

export interface ResumenCategoria {
  categoria: string;
  ingresos: number;
  gastos: number;
  ivaTrasladado: number;
  ivaAcreditable: number;
}

export interface FacturaExcluida {
  descripcion: string;
  motivo: string;
}
