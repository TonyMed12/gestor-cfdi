import { registrarAccion } from "@/lib/bitacora";
import { getCliente, getResumenPeriodo } from "@/lib/datos";
import { supabaseServidor } from "@/lib/supabase-servidor";
import { aCsv, filasCsv, libroResumen, nombreArchivo, type DatosExportacion } from "@/lib/exportar-resumen";
import { describirCierre } from "@/lib/cierre";
import { esMesAnio, nombreMes } from "@/lib/formato";
import { nombrePdf, pdfResumen } from "@/lib/pdf-resumen";

// Descarga del resumen de un periodo (RF-42): /resumen/exportar?cliente=<id>&periodo=AAAA-MM[&formato=xlsx].
// - CSV (D1, por omisión): una tabla con una fila por factura, para importar a otros programas.
// - Excel (D2, formato=xlsx): hojas «Resumen» y «Detalle» con formato.
// - PDF (D3, formato=pdf): el resumen con encabezado del cliente y del periodo, en una o dos hojas carta.
// Sin sesión, el proxy lleva a /login; con sesión, RLS limita los datos a tu despacho, igual que en la pantalla.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get("cliente") ?? "";
  const mesAnio = url.searchParams.get("periodo") ?? "";
  const formato = url.searchParams.get("formato") ?? "csv";
  if (!/^[0-9a-f-]{36}$/i.test(clienteId) || !esMesAnio(mesAnio) || (formato !== "csv" && formato !== "xlsx" && formato !== "pdf")) {
    return new Response("Elige un cliente, un periodo y un formato válidos.", { status: 400 });
  }

  const cliente = await getCliente(clienteId);
  const datos = cliente ? await getResumenPeriodo(cliente.id, mesAnio) : undefined;
  if (!cliente || !datos) return new Response("No se encontró ese cliente o ese periodo.", { status: 404 });

  // D6 (RF-47): quién exportó qué periodo, en qué formato y cuándo (la base pone quién y cuándo).
  // Primero la bitácora: si no se puede registrar, no se entrega el archivo.
  try {
    await registrarAccion(await supabaseServidor(), "exporto", {
      formato,
      cliente_id: cliente.id,
      mes_anio: datos.periodo.mesAnio,
      estado_periodo: datos.periodo.estado,
      facturas: datos.facturas.length,
      incluidas: datos.resumen.incluidas,
    });
  } catch {
    return new Response("No se pudo registrar la exportación en la bitácora. Intenta de nuevo.", { status: 500 });
  }

  const exportacion: DatosExportacion = {
    cliente: { razonSocial: cliente.razonSocial, rfc: cliente.rfc },
    periodo: { mesAnio: datos.periodo.mesAnio, nombre: nombreMes(datos.periodo.mesAnio), estado: datos.periodo.estado },
    resumen: datos.resumen,
    facturas: datos.facturas,
    generado: new Date(),
  };
  const archivo =
    formato === "pdf"
      ? {
          cuerpo: new Blob([
            (await pdfResumen({
              ...exportacion,
              cierre: datos.periodo.estado === "cerrado"
                ? describirCierre(datos.periodo.cerradoEn, datos.periodo.cerradoPor)
                : undefined,
            })) as Uint8Array<ArrayBuffer>,
          ]),
          tipo: "application/pdf",
          nombre: nombrePdf(cliente.rfc, datos.periodo.mesAnio),
        }
      : formato === "xlsx"
        ? {
            cuerpo: new Blob([libroResumen(exportacion) as Uint8Array<ArrayBuffer>]),
            tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            nombre: nombreArchivo(cliente.rfc, datos.periodo.mesAnio, "xlsx"),
          }
        : {
            cuerpo: aCsv(filasCsv(exportacion)),
            tipo: "text/csv; charset=utf-8",
            nombre: nombreArchivo(cliente.rfc, datos.periodo.mesAnio, "csv"),
          };

  return new Response(archivo.cuerpo, {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Disposition": `attachment; filename="${archivo.nombre}"`,
      // Son datos fiscales del cliente: que no queden en cachés intermedias.
      "Cache-Control": "private, no-store",
    },
  });
}
