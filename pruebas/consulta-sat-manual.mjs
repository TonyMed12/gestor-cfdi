// Muestra paso a paso cómo la plataforma lee un CFDI y le pregunta al SAT si está vigente.
// Uso: node --no-warnings pruebas/consulta-sat-manual.mjs "ruta/a/la/factura.xml"
import { readFileSync } from "node:fs";
import { leerCfdi } from "../src/lib/cfdi.ts";
import { expresionSat, interpretarEstado, solicitudSat } from "../src/lib/sat.ts";

const ruta = process.argv[2];
if (!ruta) {
  console.log('Uso: node --no-warnings pruebas/consulta-sat-manual.mjs "ruta/a/la/factura.xml"');
  process.exit(1);
}
const titulo = (t) => console.log(`\n=== ${t} ===`);

titulo("1. Se lee el XML y se sacan los datos");
const leido = leerCfdi(readFileSync(ruta, "utf8"));
if ("error" in leido) {
  console.log("No se pudo leer:", leido.error);
  process.exit(1);
}
const f = leido.factura;
const datos = [
  ["Comprobante > Fecha", f.emitido_en],
  ["Comprobante > TipoDeComprobante", f.tipo_comprobante],
  ["Comprobante > SubTotal", f.subtotal],
  ["Comprobante > Total", f.total],
  ["Comprobante > Moneda", f.moneda],
  ["Emisor > Rfc", f.rfc_emisor],
  ["Emisor > Nombre", f.nombre_emisor],
  ["Receptor > Rfc", f.rfc_receptor],
  ["Receptor > Nombre", f.nombre_receptor],
  ["Receptor > UsoCFDI", f.uso_cfdi],
  ["Complemento > TimbreFiscalDigital > UUID", f.uuid_fiscal],
  ["Comprobante > Sello (últimos 8 caracteres)", f.sello?.slice(-8)],
  ["Conceptos", `${leido.conceptos.length} concepto(s)`],
];
for (const [etiqueta, valor] of datos) console.log(`  ${etiqueta.padEnd(44)} ${valor}`);

titulo("2. Revisión de la factura");
console.log(leido.exclusion ? `  Se leyó, pero quedaría excluida: ${leido.exclusion}` : "  Correcta: es un CFDI 4.0 timbrado y sus importes suman el total.");

titulo("3. La pregunta que se le hace al SAT (es la misma que lleva el código QR)");
const consulta = { uuid: f.uuid_fiscal, rfcEmisor: f.rfc_emisor, rfcReceptor: f.rfc_receptor, total: f.total, sello: f.sello };
const expresion = expresionSat(consulta);
console.log("  " + expresion);
console.log("\n  La misma pregunta, como dirección del verificador web del SAT (ábrela en el navegador):");
console.log("  https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx" + expresion);

titulo("4. El mensaje que se envía por internet");
const { url, headers, body } = solicitudSat(consulta);
console.log("  POST " + url);
for (const [k, v] of Object.entries(headers)) console.log(`  ${k}: ${v}`);
console.log("\n  " + body);

titulo("5. La respuesta cruda del SAT");
try {
  const inicio = Date.now();
  const respuesta = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
  const texto = await respuesta.text();
  console.log(`  HTTP ${respuesta.status} en ${Date.now() - inicio} ms\n`);
  console.log("  " + texto);

  titulo("6. Cómo se interpreta");
  console.log("  Estado:", interpretarEstado(texto) ?? "no se entendió la respuesta");
} catch (e) {
  console.log("  El SAT no respondió:", e.message);
}
