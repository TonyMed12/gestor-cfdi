import { getCliente, getResumenPeriodo } from "@/lib/datos";
import { aCsv, filasCsv, libroResumen, nombreArchivo, type DatosExportacion } from "@/lib/exportar-resumen";
import { esMesAnio, nombreMes } from "@/lib/formato";

// Descarga del resumen de un periodo (RF-42): /resumen/exportar?cliente=<id>&periodo=AAAA-MM[&formato=xlsx].
// - CSV (D1, por omisión): una tabla con una fila por factura, para importar a otros programas.
// - Excel (D2, formato=xlsx): hojas «Resumen» y «Detalle» con formato.
// Sin sesión, el proxy lleva a /login; con sesión, RLS limita los datos a tu despacho, igual que en la pantalla.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get("cliente") ?? "";
  const mesAnio = url.searchParams.get("periodo") ?? "";
  const formato = url.searchParams.get("formato") ?? "csv";
  if (!/^[0-9a-f-]{36}$/i.test(clienteId) || !esMesAnio(mesAnio) || (formato !== "csv" && formato !== "xlsx")) {
    return new Response("Elige un cliente, un periodo y un formato válidos.", { status: 400 });
  }

  const cliente = await getCliente(clienteId);
  const datos = cliente ? await getResumenPeriodo(cliente.id, mesAnio) : undefined;
  if (!cliente || !datos) return new Response("No se encontró ese cliente o ese periodo.", { status: 404 });

  const exportacion: DatosExportacion = {
    cliente: { razonSocial: cliente.razonSocial, rfc: cliente.rfc },
    periodo: { mesAnio: datos.periodo.mesAnio, nombre: nombreMes(datos.periodo.mesAnio), estado: datos.periodo.estado },
    resumen: datos.resumen,
    facturas: datos.facturas,
    generado: new Date(),
  };
  const cuerpo: BodyInit =
    formato === "xlsx" ? new Blob([libroResumen(exportacion) as Uint8Array<ArrayBuffer>]) : aCsv(filasCsv(exportacion));

  return new Response(cuerpo, {
    headers: {
      "Content-Type":
        formato === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo(cliente.rfc, datos.periodo.mesAnio, formato)}"`,
      // Son datos fiscales del cliente: que no queden en cachés intermedias.
      "Cache-Control": "private, no-store",
    },
  });
}
