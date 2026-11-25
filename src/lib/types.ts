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

// "emisor": regla del contador por RFC. "regla": clave asignada a mano. "division": sugerencia por división del SAT.
export type OrigenClasificacion = "ia" | "emisor" | "regla" | "base" | "division";

export interface Cliente {
  id: string;
  razonSocial: string;
  rfc: string;
  activo?: boolean;
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
  id?: string;
  categoriaGuardada?: string | null; // categoría fijada al aprobar (null = aún no aprobada)
  categoria?: string; // se calcula al leer, según la prioridad de datos.ts
  origen?: OrigenClasificacion;
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
  formaPago: string | null;
  regimenReceptor?: string | null;
  fuente?: "xml" | "pdf"; // de dónde se leyó la factura (RN-04)
  metodoPago: "PUE" | "PPD" | null;
  moneda: string;
  subtotal: number;
  total: number;
  fechaEmision: string;
  fechaTimbrado: string;
  fechaConsultaSat: string;
  estadoSat: EstadoSat;
  estadoRevision: EstadoRevision;
  motivoExclusion?: string;
  deducible?: boolean | null; // A7: null = según la categoría; true o false = marca del contador (solo recibidas)
  prioridad: "alta" | "normal";
  motivoPrioridad?: string;
  categoriaPropuesta: string;
  origenClasificacion?: OrigenClasificacion; // aún no se guarda en la base (S3-05)
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
