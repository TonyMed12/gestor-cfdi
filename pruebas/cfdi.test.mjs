import assert from "node:assert/strict";
import { test } from "node:test";
import { leerCfdi } from "../src/lib/cfdi.ts";

// Fabrica un CFDI 4.0 de ejemplo (datos inventados). Cada prueba cambia solo lo que necesita.
function cfdi({
  version = "4.0", tipo = "I", moneda = "MXN", subtotal = "2600.00", total = "3016.00",
  trasladado = "416.00", retenido = null, descuento = null,
  conceptos = `<cfdi:Concepto ClaveProdServ="14111507" Cantidad="4" ClaveUnidad="H87" Unidad="Pieza" Descripcion="Papel bond" ValorUnitario="650.00" Importe="2600.00" ObjetoImp="02">
      <cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="2600.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="416.00"/></cfdi:Traslados></cfdi:Impuestos>
    </cfdi:Concepto>`,
  timbre = `<cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="6F9A3C2E-41B7-4D0A-9C5E-2B7F81A4D903" FechaTimbrado="2026-10-14T10:05:00"/></cfdi:Complemento>`,
} = {}) {
  const globales = trasladado || retenido
    ? `<cfdi:Impuestos${trasladado ? ` TotalImpuestosTrasladados="${trasladado}"` : ""}${retenido ? ` TotalImpuestosRetenidos="${retenido}"` : ""}/>`
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="${version}" Fecha="2026-10-14T10:00:00" FormaPago="03" MetodoPago="PUE"
  SubTotal="${subtotal}"${descuento ? ` Descuento="${descuento}"` : ""} Moneda="${moneda}" Total="${total}" TipoDeComprobante="${tipo}" Exportacion="01" LugarExpedicion="64000">
  <cfdi:Emisor Rfc="PDE150101XY2" Nombre="Papelería Demo SA de CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="CEJ190312AB1" Nombre="Comercializadora Ejemplo SA de CV" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>${conceptos}</cfdi:Conceptos>
  ${globales}
  ${timbre}
</cfdi:Comprobante>`;
}

test("lee un CFDI 4.0 simple", () => {
  const r = leerCfdi(cfdi());
  assert.equal(r.error, undefined);
  assert.equal(r.exclusion, null);
  assert.equal(r.factura.uuid_fiscal, "6F9A3C2E-41B7-4D0A-9C5E-2B7F81A4D903");
  assert.equal(r.factura.rfc_emisor, "PDE150101XY2");
  assert.equal(r.factura.nombre_emisor, "Papelería Demo SA de CV");
  assert.equal(r.factura.rfc_receptor, "CEJ190312AB1");
  assert.equal(r.factura.uso_cfdi, "G03");
  assert.equal(r.factura.forma_pago, "03");
  assert.equal(r.factura.metodo_pago, "PUE");
  assert.equal(r.factura.total, "3016.00");
  assert.equal(r.factura.emitido_en, "2026-10-14T10:00:00-06:00");
  assert.equal(r.conceptos.length, 1);
  assert.deepEqual(r.conceptos[0].impuestos, [{ tipo: "trasladado", impuesto: "IVA", tasa: 0.16, importe: "416.00" }]);
});

test("lee varios conceptos con distintas tasas, retenciones y un concepto exento", () => {
  const conceptos = `
    <cfdi:Concepto ClaveProdServ="80101505" Cantidad="1" Descripcion="Asesoría" Importe="1000.00" ObjetoImp="02"><cfdi:Impuestos>
      <cfdi:Traslados><cfdi:Traslado Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/></cfdi:Traslados></cfdi:Impuestos></cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="50202306" Cantidad="2" Descripcion="Agua" Importe="500.00" ObjetoImp="02"><cfdi:Impuestos>
      <cfdi:Traslados><cfdi:Traslado Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="0.00"/></cfdi:Traslados></cfdi:Impuestos></cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="80141601" Cantidad="1" Descripcion="Honorarios" Importe="200.00" ObjetoImp="02"><cfdi:Impuestos>
      <cfdi:Traslados><cfdi:Traslado Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="32.00"/></cfdi:Traslados>
      <cfdi:Retenciones><cfdi:Retencion Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.100000" Importe="20.00"/></cfdi:Retenciones></cfdi:Impuestos></cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" Descripcion="Libro" Importe="0.00" ObjetoImp="02"><cfdi:Impuestos>
      <cfdi:Traslados><cfdi:Traslado Base="0" Impuesto="002" TipoFactor="Exento"/></cfdi:Traslados></cfdi:Impuestos></cfdi:Concepto>`;
  const r = leerCfdi(cfdi({ conceptos, subtotal: "1700.00", total: "1872.00", trasladado: "192.00", retenido: "20.00" }));
  assert.equal(r.exclusion, null);
  assert.equal(r.conceptos.length, 4);
  assert.deepEqual(r.conceptos[2].impuestos.map((i) => `${i.tipo}:${i.impuesto}:${i.tasa}`), ["trasladado:IVA:0.16", "retenido:ISR:0.1"]);
  assert.deepEqual(r.conceptos[3].impuestos, []); // el exento no genera impuesto
});

test("un concepto único se lee igual que varios (el parser no lo confunde)", () => {
  assert.equal(leerCfdi(cfdi()).conceptos.length, 1);
});

test("si los importes no suman el total, la factura se marca para excluir con su motivo", () => {
  const r = leerCfdi(cfdi({ total: "9999.00" }));
  assert.equal(r.factura.total, "9999.00");
  assert.match(r.exclusion, /no suman el total/);
  assert.match(leerCfdi(cfdi({ subtotal: "100.00" })).exclusion, /no suman el subtotal/);
});

test("tolera una diferencia de redondeo de un centavo", () => {
  assert.equal(leerCfdi(cfdi({ total: "3016.01" })).exclusion, null);
});

test("el descuento se resta del total", () => {
  assert.equal(leerCfdi(cfdi({ descuento: "100.00", total: "2916.00" })).exclusion, null);
});

test("suma los impuestos locales del complemento (retención cedular) y acepta importes con seis decimales", () => {
  const conceptos = `<cfdi:Concepto ClaveProdServ="86141501" Cantidad="1" Descripcion="Asesoría" Importe="1000.000000" ObjetoImp="02"><cfdi:Impuestos>
    <cfdi:Traslados><cfdi:Traslado Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.000000"/></cfdi:Traslados>
    <cfdi:Retenciones><cfdi:Retencion Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.012500" Importe="12.500000"/></cfdi:Retenciones></cfdi:Impuestos></cfdi:Concepto>`;
  const locales = `<implocal:ImpuestosLocales xmlns:implocal="http://www.sat.gob.mx/implocal" version="1.0" TotaldeRetenciones="20.00" TotaldeTraslados="0.00">
      <implocal:RetencionesLocales ImpLocRetenido="Impuesto Cedular" TasadeRetencion="2.00" Importe="20.00"/></implocal:ImpuestosLocales>`;
  const timbre = `<cfdi:Complemento>${locales}<tfd:TimbreFiscalDigital xmlns:tfd="x" UUID="6F9A3C2E-41B7-4D0A-9C5E-2B7F81A4D903" FechaTimbrado="2026-10-14T10:05:00"/></cfdi:Complemento>`;
  // 1000 + 160 - 12.50 (ISR) - 20 (cedular) = 1127.50
  const r = leerCfdi(cfdi({ conceptos, timbre, subtotal: "1000.00", total: "1127.50", trasladado: "160.00", retenido: "12.50" }));
  assert.equal(r.exclusion, null);
  assert.equal(r.conceptos[0].impuestos[1].tasa, 0.0125);
  // Sin considerar el complemento, el total no cuadraría: el lector lo detecta si el total no coincide.
  assert.match(leerCfdi(cfdi({ conceptos, timbre, subtotal: "1000.00", total: "1147.50", trasladado: "160.00", retenido: "12.50" })).exclusion, /no suman el total/);
});

test("un total de impuestos con formato inválido se rechaza (no pasa en silencio)", () => {
  assert.match(leerCfdi(cfdi({ trasladado: "abc" })).error, /Total de impuestos con formato inválido/);
});

test("acepta un CFDI de pago con total cero y moneda XXX", () => {
  const conceptos = `<cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>`;
  const r = leerCfdi(cfdi({ tipo: "P", moneda: "XXX", subtotal: "0", total: "0", trasladado: null, conceptos }));
  assert.equal(r.error, undefined);
  assert.equal(r.exclusion, null);
  assert.equal(r.factura.tipo_comprobante, "P");
});

test("rechaza lo que no es un CFDI 4.0 timbrado, con un motivo claro", () => {
  assert.match(leerCfdi("esto no es xml").error, /no tiene el nodo Comprobante/);
  assert.match(leerCfdi("<factura><total>1</total></factura>").error, /no tiene el nodo Comprobante/);
  assert.match(leerCfdi(cfdi({ version: "3.3" })).error, /Solo se aceptan CFDI 4.0 \(este es versión 3.3\)/);
  assert.match(leerCfdi(cfdi({ timbre: "" })).error, /no está timbrado/);
  assert.match(leerCfdi(cfdi({ timbre: `<cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="x" UUID="no-es-uuid" FechaTimbrado="2026-10-14T10:05:00"/></cfdi:Complemento>` })).error, /inválidos/);
  assert.match(leerCfdi(cfdi({ tipo: "Z" })).error, /Tipo de comprobante desconocido/);
  assert.match(leerCfdi(cfdi({ conceptos: "" })).error, /no tiene conceptos/);
  assert.match(leerCfdi(cfdi({ subtotal: "1,000.00" })).error, /formato inválido/);
});

test("rechaza un impuesto desconocido o una cuota fuera de rango", () => {
  const raro = `<cfdi:Concepto ClaveProdServ="1" Cantidad="1" Descripcion="X" Importe="100.00"><cfdi:Impuestos><cfdi:Traslados>
    <cfdi:Traslado Impuesto="999" TipoFactor="Tasa" TasaOCuota="0.16" Importe="16.00"/></cfdi:Traslados></cfdi:Impuestos></cfdi:Concepto>`;
  assert.match(leerCfdi(cfdi({ conceptos: raro })).error, /Impuesto inválido/);
  const cuota = raro.replace('Impuesto="999" TipoFactor="Tasa" TasaOCuota="0.16"', 'Impuesto="003" TipoFactor="Cuota" TasaOCuota="1234.5"');
  assert.match(leerCfdi(cfdi({ conceptos: cuota })).error, /fuera de rango/);
});
