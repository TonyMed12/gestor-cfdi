// Importe con su moneda, por ejemplo "$3,016.00". Si la moneda no es un código válido
// (por ejemplo, una factura guardada antes de validarla), muestra el número y la clave
// en lugar de lanzar un error que rompería la página.
export function dinero(total: string, moneda: string) {
  try {
    return Number(total).toLocaleString("es-MX", { style: "currency", currency: moneda });
  } catch {
    return `${Number(total).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
  }
}
