import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { BuscadorUuid, ResultadosUuid } from "@/components/BuscadorUuid";
import { Paginacion } from "@/components/Paginacion";
import { interpretarBusquedaUuid } from "@/lib/busqueda";
import { leerPagina } from "@/lib/paginacion";
import { ESTADO_SAT } from "@/lib/catalogos-cfdi";
import { NOMBRE_APP } from "@/lib/config";
import {
  buscarFacturasPorUuid,
  getArchivos,
  getCategoriasDeCliente,
  getCliente,
  getEnlaceEnvio,
  getPerfil,
  getPeriodosCliente,
  getResumenCategoriasCliente,
  LIMITE_RESULTADOS_UUID,
} from "@/lib/datos";
import { dinero } from "@/lib/formato";
import { CategoriasDelCliente, EditarCliente, ReconsultarPeriodo } from "./AjustesCliente";
import { EnlaceEnvio } from "./EnlaceEnvio";
import { ReintentarLectura } from "./ReintentarLectura";
import { SubirArchivos } from "./SubirArchivos";
import { VerArchivo } from "./VerArchivo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  const cliente = await getCliente(clienteId);
  return { title: `${cliente?.razonSocial ?? "Cliente"} · ${NOMBRE_APP}` };
}

const estadoLabel: Record<string, { text: string; variant: "success" | "warn" | "neutral" }> = {
  recibido: { text: "Recibido", variant: "neutral" },
  leyendo: { text: "Leyendo", variant: "warn" },
  por_revisar: { text: "Por revisar", variant: "warn" },
  clasificado: { text: "Clasificado", variant: "success" },
  error: { text: "Con error", variant: "warn" },
};

const tipoLabel: Record<string, string> = { xml: "XML", pdf: "PDF", imagen: "Imagen", zip: "ZIP" };

export default async function ClienteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>;
  searchParams: Promise<{ uuid?: string; pagina?: string }>;
}) {
  const { clienteId } = await params;
  const { uuid, pagina } = await searchParams;
  const cliente = await getCliente(clienteId);
  if (!cliente) notFound();
  // Búsqueda por folio fiscal (B1), solo entre las facturas de este cliente.
  const textoBusqueda = (uuid ?? "").trim();
  const busqueda = interpretarBusquedaUuid(textoBusqueda);
  const buscando = busqueda.tipo === "completo" || busqueda.tipo === "fragmento";
  const resultadosUuid = buscando ? await buscarFacturasPorUuid(busqueda, cliente.id) : [];
  // B4: de 50 en 50, los más recientes primero.
  const { archivos, pagina: paginaArchivos } = await getArchivos(clienteId, leerPagina(pagina));
  const resumen = await getResumenCategoriasCliente(clienteId);
  const perfil = await getPerfil();
  const puedeEditar = perfil?.rol === "administrador" || perfil?.rol === "contador";
  // El token solo se entrega a quien puede regenerarlo; auxiliares no lo ven.
  const enlace = puedeEditar ? await getEnlaceEnvio(cliente.id) : null;
  const categoriasCliente = puedeEditar ? await getCategoriasDeCliente(cliente.id) : [];
  // C8: la consulta al SAT es por periodo abierto; aquí se ofrece el más reciente.
  const periodoAbierto = puedeEditar
    ? (await getPeriodosCliente(cliente.id)).find((p) => p.estado === "abierto")
    : undefined;

  return (
    <AppShell active="/clientes">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">
          <Link href="/clientes">Clientes</Link> / {cliente.razonSocial}
        </span>
        <h1 className="m-0 text-[30px] font-bold">{cliente.razonSocial}</h1>
        <span className="font-mono text-sm text-text-muted">
          {cliente.rfc}
        </span>
        <Link
          href={`/clientes/${cliente.id}/periodos`}
          className="mt-2 inline-flex h-10 w-fit items-center rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold text-text no-underline"
        >
          Ver periodos
        </Link>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold">Por categoría</h2>
          <p className="m-0 text-sm text-text-muted">Solo facturas aprobadas. Es una versión preliminar del resumen del periodo.</p>
        </div>
        {resumen.length === 0 ? (
          <p className="m-0 text-sm text-text-muted">Aún no hay facturas aprobadas para este cliente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-text-muted">
                  <th className="py-2 font-semibold">Tipo</th>
                  <th className="py-2 font-semibold">Categoría</th>
                  <th className="py-2 text-right font-semibold">Facturas</th>
                  <th className="py-2 text-right font-semibold">Subtotal</th>
                  <th className="py-2 text-right font-semibold">IVA trasladado</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((f) => (
                  <tr key={`${f.tipo}-${f.categoria}`} className="border-t border-[#EEF1F4]">
                    <td className="py-2">{f.tipo}</td>
                    <td className="py-2 font-semibold">{f.categoria}</td>
                    <td className="py-2 text-right">{f.facturas}</td>
                    <td className="py-2 text-right font-mono">{f.subtotal.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                    <td className="py-2 text-right font-mono">{f.ivaTrasladado.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SubirArchivos clienteId={cliente.id} />

      {puedeEditar && (
        <details className="group rounded-xl border border-border bg-surface p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-lg font-semibold">
            Editar cliente
            <span className="text-sm font-normal text-text-muted group-open:hidden">Mostrar</span>
            <span className="hidden text-sm font-normal text-text-muted group-open:inline">Ocultar</span>
          </summary>
          <div className="mt-5 flex flex-col gap-5">
            <EditarCliente clienteId={cliente.id} razonSocial={cliente.razonSocial} activo={cliente.activo ?? true} />
            <div className="border-t border-[#EEF1F4] pt-5">
              <h3 className="m-0 mb-3 text-base font-semibold">Categorías propias</h3>
              <CategoriasDelCliente clienteId={cliente.id} categorias={categoriasCliente} />
            </div>
            <div className="border-t border-[#EEF1F4] pt-5">
              <h3 className="m-0 mb-3 text-base font-semibold">Consulta al SAT</h3>
              {periodoAbierto ? (
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm text-text-muted">
                    Vuelve a consultar el periodo abierto más reciente. Para otro periodo, usa el botón en su{" "}
                    <Link href={`/clientes/${cliente.id}/periodos`}>lista de periodos</Link>.
                  </p>
                  <ReconsultarPeriodo clienteId={cliente.id} mesAnio={periodoAbierto.mesAnio} />
                </div>
              ) : (
                <p className="m-0 text-sm text-text-muted">El cliente no tiene periodos abiertos.</p>
              )}
            </div>
          </div>
        </details>
      )}

      {puedeEditar && <EnlaceEnvio clienteId={cliente.id} enlaceInicial={enlace} />}

      <section id="archivos" className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-4.5">
          <h2 className="m-0 text-lg font-semibold">Archivos del cliente</h2>
          <BuscadorUuid
            accion={`/clientes/${cliente.id}#archivos`}
            valor={textoBusqueda}
            error={busqueda.tipo === "invalida" ? busqueda.error : undefined}
          />
        </div>
        {buscando ? (
          <div className="p-4">
            <ResultadosUuid
              resultados={resultadosUuid}
              busqueda={textoBusqueda.toUpperCase()}
              limite={LIMITE_RESULTADOS_UUID}
              mostrarCliente={false}
            />
          </div>
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-text-muted">
                <th className="px-5 py-3 font-semibold">Archivo</th>
                <th className="px-3 py-3 font-semibold">Tipo</th>
                <th className="px-3 py-3 font-semibold">Recibido</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {archivos.map((a) => {
                const estado = estadoLabel[a.estado] ?? { text: a.estado, variant: "neutral" as const };
                return (
                  <tr key={a.id} className="border-t border-[#EEF1F4]">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold">{a.nombre}</div>
                      {a.factura && (
                        <div className="text-[13px] text-text-muted">
                          {a.factura.emisor} → {a.factura.receptor} ·{" "}
                          {dinero(a.factura.total, a.factura.moneda)} ·{" "}
                          <span className="font-mono">{a.factura.uuid}</span> · SAT:{" "}
                          {a.factura.estadoSat ? ESTADO_SAT[a.factura.estadoSat].texto : "sin consultar"}
                        </div>
                      )}
                      {a.motivoError && (
                        <div className="text-[13px] text-warn-soft-text">{a.motivoError}</div>
                      )}
                    </td>
                    <td className="px-3 py-3.5">{tipoLabel[a.tipo] ?? a.tipo}</td>
                    <td className="px-3 py-3.5">
                      {new Date(a.recibidoEn).toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Mexico_City",
                      })}
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge variant={estado.variant}>{estado.text}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        {a.tipo === "xml" || a.tipo === "pdf" ? (
                          <Link href={`/clientes/${cliente.id}/archivos/${a.id}`} aria-label={`Ver ${a.nombre}`} className="text-sm font-semibold">
                            Ver
                          </Link>
                        ) : (
                          <VerArchivo ruta={a.ruta} nombre={a.nombre} />
                        )}
                        {a.tipo === "xml" && !a.factura && ["error", "recibido", "leyendo"].includes(a.estado) && (
                          <ReintentarLectura archivoId={a.id} nombre={a.nombre} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {archivos.length === 0 && (
            <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
              Aún no hay archivos de este cliente.
            </p>
          )}
        </div>
        <Paginacion ruta={`/clientes/${cliente.id}`} pagina={paginaArchivos} ancla="archivos" nombre="archivos" />
        </>
        )}
      </section>
    </AppShell>
  );
}
