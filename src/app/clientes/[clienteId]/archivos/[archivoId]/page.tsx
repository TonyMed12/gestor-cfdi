import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { describir, ESTADO_SAT, FORMA_PAGO, METODO_PAGO, MONEDA, TIPO_COMPROBANTE } from "@/lib/catalogos-cfdi";
import { detalleCfdi } from "@/lib/cfdi";
import { NOMBRE_APP } from "@/lib/config";
import { getArchivoParaVer, getCliente, getDescripcionesSat, getPerfil } from "@/lib/datos";
import { VerArchivo } from "../../VerArchivo";
import { BotonSat } from "./BotonSat";

export const metadata = { title: `Detalle del CFDI · ${NOMBRE_APP}` };

function dinero(valor: string | null, moneda: string | null) {
  if (valor === null) return "—";
  const n = Number(valor);
  try {
    return n.toLocaleString("es-MX", { style: "currency", currency: moneda?.length === 3 ? moneda : "MXN" });
  } catch {
    return n.toLocaleString("es-MX", { minimumFractionDigits: 2 });
  }
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="m-0 mb-1 text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

function Fila({ etiqueta, valor, mono, fuerte }: { etiqueta: string; valor: ReactNode; mono?: boolean; fuerte?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-[14px]">
      <dt className={`shrink-0 ${fuerte ? "font-semibold" : "text-text-muted"}`}>{etiqueta}</dt>
      <dd className={`m-0 text-right ${mono ? "font-mono text-[13px]" : ""} ${fuerte ? "font-bold text-accent-soft-text" : ""}`}>{valor}</dd>
    </div>
  );
}

export default async function DetalleArchivoPage({
  params,
}: {
  params: Promise<{ clienteId: string; archivoId: string }>;
}) {
  const { clienteId, archivoId } = await params;
  const cliente = await getCliente(clienteId);
  if (!cliente) notFound();
  const encontrado = await getArchivoParaVer(clienteId, archivoId);
  if (!encontrado || encontrado.archivo.tipo !== "xml") notFound();
  const { archivo, xml, sat } = encontrado;
  const perfil = await getPerfil();
  const puedeConsultar = perfil?.rol === "administrador" || perfil?.rol === "contador";
  const estadoSat = sat?.estado ? ESTADO_SAT[sat.estado] : null;

  const detalle = xml === null ? { error: "No se pudo abrir el archivo guardado" } : detalleCfdi(xml);
  const d = "error" in detalle ? null : detalle;
  const catalogos = d
    ? await getDescripcionesSat([d.receptor.uso ?? ""], [d.emisor.regimen ?? "", d.receptor.regimen ?? ""])
    : null;
  const nombre = archivo.ruta_original.split("/").pop() ?? "";

  return (
    <AppShell active="/clientes">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">
            <Link href="/clientes">Clientes</Link> / <Link href={`/clientes/${cliente.id}`}>{cliente.razonSocial}</Link>
          </span>
          <h1 className="m-0 text-[22px] font-bold break-all">{nombre}</h1>
        </div>
        <div className="rounded-lg border border-accent px-3 py-1.5">
          <VerArchivo ruta={archivo.ruta_original} etiqueta="Abrir XML original" />
        </div>
      </header>

      {archivo.estado === "error" && archivo.motivo_error && (
        <div role="alert" className="rounded-xl border border-border bg-warn-soft px-5 py-3 text-[14px] text-warn-soft-text">
          <strong>Este archivo quedó con error:</strong> {archivo.motivo_error}
        </div>
      )}

      {!d ? (
        <div role="alert" className="rounded-xl border border-border bg-surface px-5 py-6 text-[15px]">
          No se puede mostrar el resumen: {"error" in detalle ? detalle.error : ""}.
        </div>
      ) : (
        <article className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-border pb-4">
            <h2 className="m-0 mr-1 text-lg font-semibold">Resumen del CFDI</h2>
            {d.version && <Badge variant="success">v{d.version}</Badge>}
            {d.tipo && <Badge>{describir(TIPO_COMPROBANTE, d.tipo)}</Badge>}
            <Badge variant={d.timbrado ? "success" : "warn"}>{d.timbrado ? "Timbrado" : "Sin timbre"}</Badge>
            {sat && (
              <Badge variant={estadoSat?.variante ?? "neutral"}>
                SAT: {estadoSat?.texto ?? "sin consultar"}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
            <Seccion titulo="Datos generales">
              <dl className="m-0">
                <Fila etiqueta="Serie" valor={d.serie ?? "—"} />
                <Fila etiqueta="Folio" valor={d.folio ?? "—"} />
                <Fila etiqueta="Fecha" valor={d.fecha?.replace("T", " ") ?? "—"} />
                <Fila etiqueta="Lugar de expedición" valor={d.lugarExpedicion ?? "—"} />
                <Fila etiqueta="Moneda" valor={describir(MONEDA, d.moneda)} />
                <Fila etiqueta="Método de pago" valor={describir(METODO_PAGO, d.metodoPago)} />
                <Fila etiqueta="Forma de pago" valor={describir(FORMA_PAGO, d.formaPago)} />
              </dl>
            </Seccion>

            <Seccion titulo="Montos">
              <dl className="m-0">
                <Fila etiqueta="Subtotal" valor={dinero(d.subtotal, d.moneda)} mono />
                {d.descuento && Number(d.descuento) > 0 && (
                  <Fila etiqueta="Descuento" valor={`-${dinero(d.descuento, d.moneda)}`} mono />
                )}
                {d.traslados.map((t) => (
                  <Fila key={`t-${t.impuesto}`} etiqueta={`${t.impuesto} trasladado`} valor={dinero(t.importe, d.moneda)} mono />
                ))}
                {d.retenciones.map((r) => (
                  <Fila key={`r-${r.impuesto}`} etiqueta={`${r.impuesto} retenido`} valor={`-${dinero(r.importe, d.moneda)}`} mono />
                ))}
                {d.locales.map((l, i) => (
                  <Fila
                    key={`l-${i}`}
                    etiqueta={`${l.nombre} (${l.tipo} local)`}
                    valor={`${l.tipo === "retención" ? "-" : ""}${dinero(l.importe, d.moneda)}`}
                    mono
                  />
                ))}
                <div className="mt-1 border-t border-border pt-1">
                  <Fila etiqueta="Total" valor={`${dinero(d.total, d.moneda)} ${d.moneda ?? ""}`} mono fuerte />
                </div>
              </dl>
            </Seccion>

            <Seccion titulo="Emisor">
              <dl className="m-0">
                <Fila etiqueta="RFC" valor={d.emisor.rfc ?? "—"} mono />
                <Fila etiqueta="Nombre" valor={d.emisor.nombre ?? "—"} />
                <Fila etiqueta="Régimen fiscal" valor={describir(catalogos?.regimen ?? {}, d.emisor.regimen)} />
              </dl>
            </Seccion>

            <Seccion titulo="Receptor">
              <dl className="m-0">
                <Fila etiqueta="RFC" valor={d.receptor.rfc ?? "—"} mono />
                <Fila etiqueta="Nombre" valor={d.receptor.nombre ?? "—"} />
                <Fila etiqueta="Uso del CFDI" valor={describir(catalogos?.uso ?? {}, d.receptor.uso)} />
                <Fila etiqueta="C.P. fiscal" valor={d.receptor.codigoPostal ?? "—"} />
                <Fila etiqueta="Régimen fiscal" valor={describir(catalogos?.regimen ?? {}, d.receptor.regimen)} />
              </dl>
            </Seccion>
          </div>

          <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
            <Seccion titulo="Timbre fiscal digital">
              <dl className="m-0">
                <Fila etiqueta="UUID" valor={d.uuid ?? "—"} mono />
                <Fila etiqueta="Fecha de timbrado" valor={d.fechaTimbrado?.replace("T", " ") ?? "—"} mono />
              </dl>
            </Seccion>

            {sat && (
              <Seccion titulo="Estado ante el SAT">
                <dl className="m-0">
                  <Fila etiqueta="Estado" valor={estadoSat?.texto ?? "Sin consultar"} />
                  <Fila
                    etiqueta="Última consulta"
                    valor={
                      sat.consultadoEn
                        ? new Date(sat.consultadoEn).toLocaleString("es-MX", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "America/Mexico_City",
                          })
                        : "—"
                    }
                  />
                </dl>
                {puedeConsultar && <BotonSat archivoId={archivo.id} />}
              </Seccion>
            )}
          </div>

          <Seccion titulo={`Conceptos (${d.conceptos.length})`}>
            <div className="flex flex-col gap-2.5">
              {d.conceptos.map((k, i) => (
                <div key={i} className="rounded-xl bg-bg px-4 py-3">
                  <div className="text-[15px] font-semibold">{k.descripcion ?? "Sin descripción"}</div>
                  <div className="text-[13px] text-text-muted">
                    {k.cantidad ?? "?"} × {dinero(k.valorUnitario, d.moneda)} = {dinero(k.importe, d.moneda)} · Clave:{" "}
                    {k.clave ?? "—"} · Unidad: {k.claveUnidad ?? "—"}
                    {k.unidad ? ` (${k.unidad})` : ""}
                  </div>
                  {k.impuestos.length > 0 && (
                    <div className="mt-1 text-[13px] text-text-muted">
                      {k.impuestos
                        .map((im) => {
                          const tasa = im.tasa ? ` ${+(Number(im.tasa) * 100).toFixed(4)} %` : "";
                          return `${im.impuesto} ${im.tipo}${tasa}: ${dinero(im.importe, d.moneda)}`;
                        })
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Seccion>
        </article>
      )}
    </AppShell>
  );
}
