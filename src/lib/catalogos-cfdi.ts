// Catálogos pequeños del SAT para mostrar su descripción. El uso de CFDI y el régimen fiscal se leen de la base.
// shortcut: estos cuatro van en el código porque casi no cambian; pasarlos a tablas cuando haya que actualizarlos sin desplegar.

export const TIPO_COMPROBANTE: Record<string, string> = {
  I: "Ingreso", E: "Egreso", T: "Traslado", P: "Pago", N: "Nómina",
};

export const ESTADO_SAT: Record<string, { texto: string; variante: "success" | "warn" | "neutral" }> = {
  vigente: { texto: "Vigente", variante: "success" },
  cancelada: { texto: "Cancelada", variante: "warn" },
  no_encontrada: { texto: "No encontrada", variante: "warn" },
};

export const METODO_PAGO: Record<string, string> = {
  PUE: "Pago en una sola exhibición",
  PPD: "Pago en parcialidades o diferido",
};

export const FORMA_PAGO: Record<string, string> = {
  "01": "Efectivo", "02": "Cheque nominativo", "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito", "05": "Monedero electrónico", "06": "Dinero electrónico",
  "08": "Vales de despensa", "12": "Dación en pago", "13": "Pago por subrogación",
  "14": "Pago por consignación", "15": "Condonación", "17": "Compensación", "23": "Novación",
  "24": "Confusión", "25": "Remisión de deuda", "26": "Prescripción o caducidad",
  "27": "A satisfacción del acreedor", "28": "Tarjeta de débito", "29": "Tarjeta de servicios",
  "30": "Aplicación de anticipos", "31": "Intermediario pagos", "99": "Por definir",
};

export const MONEDA: Record<string, string> = {
  MXN: "Peso Mexicano", USD: "Dólar americano", EUR: "Euro", XXX: "Sin moneda",
};

// "99 — Por definir"; si la clave no está en el catálogo, solo se muestra la clave.
export const describir = (catalogo: Record<string, string>, clave: string | null | undefined) =>
  !clave ? "—" : catalogo[clave] ? `${clave} — ${catalogo[clave]}` : clave;
