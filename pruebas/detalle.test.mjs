import assert from "node:assert/strict";
import { test } from "node:test";
import { detalleCfdi } from "../src/lib/cfdi.ts";

// CFDI de ejemplo (datos inventados) con serie, folio, retenciones federales y un impuesto local.
const xml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:implocal="http://www.sat.gob.mx/implocal" Version="4.0" Serie="A" Folio="14"
  Fecha="2026-11-01T18:04:59" FormaPago="99" SubTotal="1000.00" Moneda="MXN" Total="1127.50" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="38600">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR DE EJEMPLO" RegimenFiscal="626"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR DE EJEMPLO" DomicilioFiscalReceptor="36000" RegimenFiscalReceptor="603" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="86141501" Cantidad="2" ClaveUnidad="E48" Unidad="Unidad de servicio" Descripcion="Asesoría" ValorUnitario="500.00" Importe="1000.000000" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados><cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.000000"/></cfdi:Traslados>
        <cfdi:Retenciones><cfdi:Retencion Base="1000.00" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.012500" Importe="12.500000"/></cfdi:Retenciones>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00" TotalImpuestosRetenidos="12.50">
    <cfdi:Retenciones><cfdi:Retencion Impuesto="001" Importe="12.50"/></cfdi:Retenciones>
    <cfdi:Traslados><cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/></cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <implocal:ImpuestosLocales version="1.0" TotaldeRetenciones="20.00" TotaldeTraslados="0.00">
      <implocal:RetencionesLocales ImpLocRetenido="Impuesto Cedular" TasadeRetencion="2.00" Importe="20.00"/>
    </implocal:ImpuestosLocales>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="2C19814F-C90C-484F-A66C-3B03E1C5D7FD" FechaTimbrado="2026-11-02T18:05:28"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

test("arma el resumen completo del CFDI", () => {
  const d = detalleCfdi(xml);
  assert.equal(d.error, undefined);
  assert.deepEqual([d.version, d.tipo, d.timbrado, d.serie, d.folio, d.lugarExpedicion], ["4.0", "I", true, "A", "14", "38600"]);
  assert.deepEqual([d.moneda, d.metodoPago, d.formaPago, d.subtotal, d.total], ["MXN", "PPD", "99", "1000.00", "1127.50"]);
  assert.deepEqual(d.emisor, { rfc: "AAA010101AAA", nombre: "EMISOR DE EJEMPLO", regimen: "626" });
  assert.deepEqual(d.receptor, { rfc: "BBB010101BBB", nombre: "RECEPTOR DE EJEMPLO", uso: "G03", codigoPostal: "36000", regimen: "603" });
  assert.equal(d.uuid, "2C19814F-C90C-484F-A66C-3B03E1C5D7FD");
  assert.equal(d.fechaTimbrado, "2026-11-02T18:05:28");
});

test("muestra los impuestos federales, los locales y los conceptos", () => {
  const d = detalleCfdi(xml);
  assert.deepEqual(d.traslados, [{ impuesto: "IVA", importe: "160.00" }]);
  assert.deepEqual(d.retenciones, [{ impuesto: "ISR", importe: "12.50" }]);
  assert.deepEqual(d.locales, [{ tipo: "retención", nombre: "Impuesto Cedular", importe: "20.00" }]);
  assert.equal(d.conceptos.length, 1);
  assert.deepEqual([d.conceptos[0].cantidad, d.conceptos[0].valorUnitario, d.conceptos[0].importe], ["2", "500.00", "1000.000000"]);
  assert.deepEqual(d.conceptos[0].impuestos.map((i) => `${i.tipo}:${i.impuesto}:${i.tasa}`), ["trasladado:IVA:0.160000", "retenido:ISR:0.012500"]);
});

test("si el comprobante no trae totales de impuestos, los suma de los conceptos", () => {
  const sinGlobales = xml.replace(/<cfdi:Impuestos TotalImpuestosTrasladados[\s\S]*?<\/cfdi:Impuestos>/, "");
  const d = detalleCfdi(sinGlobales);
  assert.deepEqual(d.traslados, [{ impuesto: "IVA", importe: "160.00" }]);
  assert.deepEqual(d.retenciones, [{ impuesto: "ISR", importe: "12.50" }]);
});

test("es tolerante: muestra lo que haya aunque falte el timbre o sea de otra versión", () => {
  const sinTimbre = detalleCfdi(xml.replace(/<tfd:TimbreFiscalDigital[^>]*\/>/, ""));
  assert.equal(sinTimbre.timbrado, false);
  assert.equal(sinTimbre.uuid, null);
  assert.equal(sinTimbre.total, "1127.50");
  assert.equal(detalleCfdi(xml.replace('Version="4.0"', 'Version="3.3"')).version, "3.3");
});

test("lo que no es un CFDI se informa con un motivo", () => {
  assert.match(detalleCfdi("esto no es xml").error, /no tiene el nodo Comprobante/);
  assert.match(detalleCfdi("<otra><cosa/></otra>").error, /no tiene el nodo Comprobante/);
});
