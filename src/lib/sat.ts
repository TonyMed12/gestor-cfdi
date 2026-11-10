export type EstadoSat = "vigente" | "cancelada" | "no_encontrada";

const URL_SAT = "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";

type DatosConsulta = { uuid: string; rfcEmisor: string; rfcReceptor: string; total: string; sello: string | null };

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Misma expresión que lleva el código QR de la factura: total con 10 enteros y 6 decimales,
// y los últimos 8 caracteres del sello.
export function expresionSat(d: DatosConsulta) {
  const [entero, decimales = ""] = d.total.split(".");
  const tt = `${entero.padStart(10, "0")}.${decimales.padEnd(6, "0").slice(0, 6)}`;
  const fe = d.sello ? `&fe=${d.sello.slice(-8)}` : "";
  return `?id=${d.uuid}&re=${d.rfcEmisor}&rr=${d.rfcReceptor}&tt=${tt}${fe}`;
}

// Devuelve el estado de la respuesta del SAT, o null si no se entiende.
export function interpretarEstado(respuesta: string): EstadoSat | null {
  const estado = respuesta.match(/<(?:\w+:)?Estado>([^<]*)<\/(?:\w+:)?Estado>/)?.[1]?.trim().toLowerCase();
  if (estado === "vigente") return "vigente";
  if (estado === "cancelado") return "cancelada";
  if (estado === "no encontrado") return "no_encontrada";
  return null;
}

// null significa "no se pudo consultar" (sin respuesta, tiempo agotado o respuesta rara); no es lo mismo que "no encontrada".
export async function consultarEstadoSat(datos: DatosConsulta): Promise<EstadoSat | null> {
  const cuerpo =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">` +
    `<soapenv:Header/><soapenv:Body><tem:Consulta><tem:expresionImpresa>${escapar(expresionSat(datos))}</tem:expresionImpresa>` +
    `</tem:Consulta></soapenv:Body></soapenv:Envelope>`;
  try {
    const respuesta = await fetch(URL_SAT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://tempuri.org/IConsultaCFDIService/Consulta",
      },
      body: cuerpo,
      signal: AbortSignal.timeout(8000),
    });
    return respuesta.ok ? interpretarEstado(await respuesta.text()) : null;
  } catch {
    return null;
  }
}
