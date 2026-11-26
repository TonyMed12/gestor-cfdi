import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NOMBRE_APP } from "@/lib/config";
import { ReconsultarPeriodo } from "@/app/clientes/[clienteId]/AjustesCliente";
import { getCliente, getClientes, getPerfil, getPeriodosPorCliente, getResumenPeriodo } from "@/lib/datos";
import { dinero, esMesAnio, nombreMes } from "@/lib/formato";
import { agruparExclusiones, cuadraConPeriodo } from "@/lib/resumen";
import { describirCierre, puedeCerrar } from "@/lib/cierre";
import { CerrarPeriodo } from "./CerrarPeriodo";
import { SelectorResumen } from "./SelectorResumen";

export const metadata = { title: `Resumen del periodo · ${NOMBRE_APP}` };

const pesos = (n: number) => dinero(String(n), "MXN");

// Resumen de un cliente en un periodo (C3): /resumen?cliente=<id>&periodo=AAAA-MM.
// El selector de cliente y periodo (C6) cambia la URL; la página se vuelve a calcular con esa selección.
export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; periodo?: string; tipo?: string; categoria?: string }>;
}) {
  const { cliente: clienteId, periodo: mesAnio, tipo: tipoPedido, categoria: categoriaPedida } = await searchParams;
  // C10: la categoría elegida en la tabla (?tipo=gasto|ingreso&categoria=Nombre) muestra las facturas que la componen.
  const tipoCategoria = tipoPedido === "ingreso" ? "Ingreso" : tipoPedido === "gasto" ? "Gasto" : undefined;
  const categoriaElegida =
    tipoCategoria && categoriaPedida ? ({ tipo: tipoCategoria, nombre: categoriaPedida.slice(0, 120) } as const) : undefined;
  const [clientes, periodosPorCliente, perfil] = await Promise.all([getClientes(), getPeriodosPorCliente(), getPerfil()]);
  const puedeEditar = perfil?.rol === "administrador" || perfil?.rol === "contador";
  const cliente = clienteId && /^[0-9a-f-]{36}$/i.test(clienteId) ? await getCliente(clienteId) : undefined;

  // Con cliente y sin periodo, se abre su periodo más reciente y queda en la URL.
  const recientes = cliente ? (periodosPorCliente[cliente.id] ?? []) : [];
  if (cliente && !mesAnio && recientes.length > 0) {
    redirect(`/resumen?cliente=${cliente.id}&periodo=${recientes[0].mesAnio}`);
  }

  const datos = cliente && mesAnio && esMesAnio(mesAnio) ? await getResumenPeriodo(cliente.id, mesAnio, categoriaElegida) : undefined;
  const selector = (
    <SelectorResumen
      clientes={clientes.map((c) => ({ id: c.id, razonSocial: c.razonSocial, periodos: periodosPorCliente[c.id] ?? [] }))}
      clienteId={cliente?.id ?? ""}
      periodo={datos ? datos.periodo.mesAnio : ""}
    />
  );

  if (!cliente || !datos) {
    return (
      <AppShell active="/resumen">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[30px] font-bold">Resumen del periodo</h1>
          <p className="m-0 text-[15px] text-text-muted">
            {cliente && recientes.length === 0
              ? `${cliente.razonSocial} aún no tiene periodos: se crean al subir su primera factura.`
              : clienteId || mesAnio
                ? "No se encontró ese cliente o ese periodo. Elige uno con el selector."
                : "Elige un cliente y uno de sus periodos para ver su resumen."}
          </p>
        </header>
        {selector}
        <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {clientes.map((c) => (
            <Link
              key={c.id}
              href={`/resumen?cliente=${c.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 no-underline hover:border-accent focus-visible:border-accent"
            >
              <span className="font-semibold text-text">{c.razonSocial}</span>
              <span className="font-mono text-sm text-text-muted">{c.rfc}</span>
              <span className="text-sm font-semibold">
                {periodosPorCliente[c.id]?.length
                  ? `Resumen de ${nombreMes(periodosPorCliente[c.id][0].mesAnio)}`
                  : "Aún sin periodos"}
              </span>
            </Link>
          ))}
          {clientes.length === 0 && <p className="m-0 text-sm text-text-muted">Aún no hay clientes.</p>}
        </section>
      </AppShell>
    );
  }

  const { periodo, resumen, excluidas, facturasCategoria } = datos;
  const urlResumen = `/resumen?cliente=${cliente.id}&periodo=${periodo.mesAnio}`;
  const urlCategoria = (tipo: string, categoria: string) =>
    `${urlResumen}&tipo=${tipo.toLowerCase()}&categoria=${encodeURIComponent(categoria)}#facturas-de-categoria`;
  const esElegida = (tipo: string, categoria: string) =>
    categoriaElegida?.tipo === tipo && categoriaElegida.nombre === categoria;
  // La fila elegida, si existe en este periodo (con otro cliente o periodo puede no existir).
  const filaElegida = resumen.filas.find((f) => esElegida(f.tipo, f.categoria));
  // C5: motivos de exclusión con su conteo, y que incluidas + fuera sumen las facturas del periodo.
  const grupos = agruparExclusiones(excluidas);
  const cuadra = cuadraConPeriodo(resumen.incluidas, excluidas.length, periodo.facturas);
  const { totales, filas, ajusteNoDesglosado } = resumen;
  const hayIeps = filas.some((f) => f.iepsTrasladado !== 0);
  const tarjetas = [
    { etiqueta: "Ingresos", valor: totales.ingresos },
    { etiqueta: "Gastos", valor: totales.gastos },
    { etiqueta: "Gastos deducibles", valor: totales.gastosDeducibles, nota: "Por la factura o su categoría" },
    { etiqueta: "IVA trasladado", valor: totales.ivaTrasladado, nota: "Cobrado en los ingresos" },
    { etiqueta: "IVA acreditable", valor: totales.ivaAcreditable, nota: "16 % u 8 % de gastos deducibles" },
    { etiqueta: "Retenciones a favor", valor: totales.retencionesAFavor, nota: "Le retuvieron al cliente" },
    { etiqueta: "Retenciones por enterar", valor: totales.retencionesPorEnterar, nota: "Retuvo el cliente" },
  ];

  return (
    <AppShell active="/resumen">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">
          <Link href={`/clientes/${cliente.id}`}>{cliente.razonSocial}</Link> /{" "}
          <Link href={`/clientes/${cliente.id}/periodos`}>Periodos</Link> /{" "}
          <Link href={`/clientes/${cliente.id}/periodos/${periodo.mesAnio}`}>{nombreMes(periodo.mesAnio)}</Link> / Resumen
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-[30px] font-bold">
            Resumen · <span className="capitalize">{nombreMes(periodo.mesAnio)}</span>
          </h1>
          {periodo.estado === "abierto" ? <Badge variant="success">Abierto</Badge> : <Badge>Cerrado</Badge>}
        </div>
        <p className="m-0 text-[15px] text-text-muted">
          {cliente.razonSocial} · <span className="font-mono text-sm">{cliente.rfc}</span>
        </p>
        {periodo.estado === "cerrado" && (
          <p className="m-0 text-sm font-semibold">
            {describirCierre(periodo.cerradoEn, periodo.cerradoPor)} Cambiar una de sus facturas pide un motivo, que
            queda en la bitácora.
          </p>
        )}
        <p className="m-0 text-sm text-text-muted">
          {resumen.incluidas === 1 ? "1 factura incluida" : `${resumen.incluidas} facturas incluidas`} ·{" "}
          {excluidas.length === 1 ? "1 fuera del resumen" : `${excluidas.length} fuera del resumen`}. Solo cuentan las
          facturas aprobadas que no están canceladas.
        </p>
      </header>

      {selector}

      <section aria-label="Totales del periodo" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        {tarjetas.map((t) => (
          <div key={t.etiqueta} className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-5">
            <span className="text-sm text-text-muted">{t.etiqueta}</span>
            <span className="font-mono text-2xl font-bold">{pesos(t.valor)}</span>
            {t.nota && <span className="text-[13px] text-text-muted">{t.nota}</span>}
          </div>
        ))}
      </section>

      {ajusteNoDesglosado.facturas > 0 && (
        <p role="note" className="m-0 rounded-lg border border-[#E7C873] bg-[#FFF8E6] px-4 py-3 text-sm">
          En {ajusteNoDesglosado.facturas === 1 ? "1 factura" : `${ajusteNoDesglosado.facturas} facturas`} el total no
          coincide con sus conceptos e impuestos guardados: diferencia de{" "}
          <span className="font-mono font-semibold">{pesos(ajusteNoDesglosado.importe)}</span>. Suelen ser descuentos o
          impuestos locales (como la retención cedular), que aún no se guardan por concepto. Esta diferencia no está en
          las cifras de arriba.
        </p>
      )}

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4.5">
          <h2 className="m-0 text-lg font-semibold">Por categoría</h2>
          <p className="m-0 text-sm text-text-muted">
            Da clic en una categoría para ver sus facturas. Importes antes de impuestos. Las notas de crédito restan. Un gasto es deducible si así se marcó la factura en
            la revisión o, si no se marcó, si su categoría es deducible. IVA acreditable: el IVA trasladado al 16 % u
            8 % de los gastos deducibles; el IVA a tasa 0 %, exento o a una tasa no vigente no se acredita.
          </p>
        </div>
        {filas.length === 0 ? (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
            Aún no hay facturas aprobadas en este periodo. Apruébalas en la bandeja de revisión.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-text-muted">
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-3 py-3 font-semibold">Categoría</th>
                  <th className="px-3 py-3 text-right font-semibold">Facturas</th>
                  <th className="px-3 py-3 text-right font-semibold">Importe</th>
                  <th className="px-3 py-3 text-right font-semibold">Deducible</th>
                  <th className="px-3 py-3 text-right font-semibold">IVA trasladado</th>
                  <th className="px-3 py-3 text-right font-semibold">IVA acreditable</th>
                  {hayIeps && <th className="px-3 py-3 text-right font-semibold">IEPS</th>}
                  <th className="px-3 py-3 text-right font-semibold">ISR retenido</th>
                  <th className="px-5 py-3 text-right font-semibold">IVA retenido</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={`${f.tipo}-${f.categoria}`}
                    aria-current={esElegida(f.tipo, f.categoria) ? "true" : undefined}
                    className={`border-t border-[#EEF1F4] ${esElegida(f.tipo, f.categoria) ? "bg-[#EEF4FF]" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <Badge variant={f.tipo === "Ingreso" ? "success" : "neutral"}>{f.tipo}</Badge>
                    </td>
                    <td className="px-3 py-3.5 font-semibold">
                      <Link
                        href={urlCategoria(f.tipo, f.categoria)}
                        title={`Ver las facturas de ${f.categoria}`}
                        className="text-text underline decoration-[#8A96A3] underline-offset-4 hover:text-accent hover:decoration-accent"
                      >
                        {f.categoria}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <Link href={urlCategoria(f.tipo, f.categoria)} className="text-accent">
                        {f.facturas}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.importe)}</td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">
                      {f.tipo === "Gasto" ? pesos(f.gastoDeducible) : "—"}
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.ivaTrasladado)}</td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">
                      {f.tipo === "Gasto" ? pesos(f.ivaAcreditable) : "—"}
                    </td>
                    {hayIeps && <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.iepsTrasladado)}</td>}
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.isrRetenido)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-sm">{pesos(f.ivaRetenido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {categoriaElegida && (
        <section
          id="facturas-de-categoria"
          aria-labelledby="titulo-facturas-de-categoria"
          className="flex scroll-mt-6 flex-col rounded-xl border border-border bg-surface"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4.5">
            <div className="flex flex-col gap-1">
              <h2 id="titulo-facturas-de-categoria" className="m-0 text-lg font-semibold">
                {categoriaElegida.tipo} · {categoriaElegida.nombre}
              </h2>
              <p className="m-0 text-sm text-text-muted">
                {filaElegida
                  ? `${filaElegida.facturas === 1 ? "La factura del periodo que compone" : `Las ${filaElegida.facturas} facturas del periodo que componen`} esta categoría, con lo que aporta cada una. Solo cuentan sus conceptos de esta categoría; las notas de crédito restan.`
                  : "Esta categoría no tiene facturas incluidas en este periodo."}
              </p>
            </div>
            <Link href={urlResumen} className="text-sm font-semibold">
              Cerrar detalle
            </Link>
          </div>
          {filaElegida && facturasCategoria && facturasCategoria.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] text-text-muted">
                    <th className="px-5 py-3 font-semibold">{filaElegida.tipo === "Gasto" ? "Emisor" : "Receptor"}</th>
                    <th className="px-3 py-3 font-semibold">Fecha</th>
                    <th className="px-3 py-3 font-semibold">Folio fiscal</th>
                    <th className="px-3 py-3 text-right font-semibold">Importe</th>
                    <th className="px-3 py-3 text-right font-semibold">Deducible</th>
                    <th className="px-3 py-3 text-right font-semibold">IVA trasladado</th>
                    <th className="px-3 py-3 text-right font-semibold">IVA acreditable</th>
                    {hayIeps && <th className="px-3 py-3 text-right font-semibold">IEPS</th>}
                    <th className="px-3 py-3 text-right font-semibold">ISR retenido</th>
                    <th className="px-3 py-3 text-right font-semibold">IVA retenido</th>
                    <th aria-label="Acciones" className="px-5 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {facturasCategoria.map((f) => (
                    <tr key={f.id} className="border-t border-[#EEF1F4]">
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold">{f.contraparte}</span>
                          <span className="text-[13px] text-text-muted">
                            <span className="font-mono">{f.contraparteRfc}</span>
                            {f.tipoComprobante === "E" && " · Nota de crédito"}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        {new Date(f.fecha).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "America/Mexico_City",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-mono text-[13px]">{f.uuid}</td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.importe)}</td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">
                        {filaElegida.tipo === "Gasto" ? pesos(f.gastoDeducible) : "—"}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.ivaTrasladado)}</td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">
                        {filaElegida.tipo === "Gasto" ? pesos(f.ivaAcreditable) : "—"}
                      </td>
                      {hayIeps && <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.iepsTrasladado)}</td>}
                      <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.isrRetenido)}</td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(f.ivaRetenido)}</td>
                      <td className="px-5 py-3.5">
                        <Link href={`/revision/${f.id}`} className="whitespace-nowrap text-sm font-semibold">
                          Ver factura
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="px-5 py-3.5" colSpan={3}>
                      Total de la categoría
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(filaElegida.importe)}</td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">
                      {filaElegida.tipo === "Gasto" ? pesos(filaElegida.gastoDeducible) : "—"}
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(filaElegida.ivaTrasladado)}</td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">
                      {filaElegida.tipo === "Gasto" ? pesos(filaElegida.ivaAcreditable) : "—"}
                    </td>
                    {hayIeps && <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(filaElegida.iepsTrasladado)}</td>}
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(filaElegida.isrRetenido)}</td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{pesos(filaElegida.ivaRetenido)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="fuera-del-resumen" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5.5">
        <div className="flex flex-col gap-1">
          <h2 id="fuera-del-resumen" className="m-0 text-lg font-semibold">
            Fuera del resumen · {excluidas.length} de {periodo.facturas}
          </h2>
          <p className={`m-0 text-sm ${cuadra ? "text-text-muted" : "font-semibold text-[#B42318]"}`}>
            {cuadra
              ? `${periodo.facturas} ${periodo.facturas === 1 ? "factura" : "facturas"} en el periodo = ${resumen.incluidas} ${resumen.incluidas === 1 ? "incluida" : "incluidas"} + ${excluidas.length} fuera del resumen.`
              : `No cuadra: el periodo tiene ${periodo.facturas} facturas, pero hay ${resumen.incluidas} incluidas y ${excluidas.length} fuera del resumen. Vuelve a cargar la página.`}{" "}
            No hay duplicadas: un folio fiscal solo puede existir una vez por cliente (RN-02).
          </p>
        </div>

        {grupos.length === 0 ? (
          <p className="m-0 text-sm text-text-muted">Todas las facturas del periodo están incluidas.</p>
        ) : (
          <>
            <ul aria-label="Facturas fuera del resumen por motivo" className="m-0 flex flex-wrap gap-2 p-0">
              {grupos.map((g) => (
                <li key={g.motivo} className="list-none">
                  <a
                    href={`#motivo-${grupos.indexOf(g)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-[#FFF6E6] px-3 py-1.5 text-sm text-warn-soft-text no-underline"
                  >
                    <span className="font-semibold">{g.facturas.length}</span> {g.motivo}
                  </a>
                </li>
              ))}
            </ul>

            {grupos.map((g, i) => (
              <div key={g.motivo} id={`motivo-${i}`} className="flex scroll-mt-6 flex-col gap-2">
                <h3 className="m-0 text-[15px] font-semibold">
                  {g.motivo} · {g.facturas.length === 1 ? "1 factura" : `${g.facturas.length} facturas`}
                </h3>
                <ul className="m-0 flex flex-col gap-1.5 p-0 text-[15px]">
                  {g.facturas.map((e) => (
                    <li key={e.id} className="list-none rounded-lg bg-[#FFF6E6] px-3.5 py-2.5">
                      <Link href={`/revision/${e.id}`} className="text-text">
                        {e.descripcion}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </section>

      {puedeEditar && periodo.estado === "abierto" && (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
          <h2 className="m-0 text-lg font-semibold">Antes de cerrar: consulta al SAT</h2>
          <p className="m-0 text-sm text-text-muted">
            Vuelve a consultar al SAT las facturas de este periodo. Si alguna se canceló después de subirla, sale del
            resumen y aparece en «Fuera del resumen» con su motivo.
          </p>
          <ReconsultarPeriodo clienteId={cliente.id} mesAnio={periodo.mesAnio} />
        </section>
      )}

      {/* D4: cerrar el periodo (solo administrador y contador, y sin facturas por revisar). */}
      {puedeEditar && periodo.estado === "abierto" && (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
          <h2 className="m-0 text-lg font-semibold">Cerrar el periodo</h2>
          <p className="m-0 text-sm text-text-muted">
            Al cerrar, el resumen de este mes queda fijo. Si después hay que aprobar, corregir o rechazar una de sus
            facturas, se pide el motivo y queda en la bitácora.
          </p>
          <CerrarPeriodo
            clienteId={cliente.id}
            mesAnio={periodo.mesAnio}
            nombreMes={nombreMes(periodo.mesAnio)}
            pendientes={periodo.conteo.porRevisar + periodo.conteo.porConfirmar}
            motivoNoCerrar={(() => {
              const r = puedeCerrar(periodo.conteo);
              return r.ok ? undefined : r.motivo;
            })()}
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {/* D2: libro de Excel con hojas Resumen y Detalle, con formato. */}
        <a
          href={`/resumen/exportar?cliente=${cliente.id}&periodo=${periodo.mesAnio}&formato=xlsx`}
          download
          className="inline-flex h-11 items-center rounded-lg border border-[#C9D1DA] bg-surface px-4 text-sm font-semibold text-text no-underline hover:border-accent"
        >
          Exportar a Excel
        </a>
        {/* D1: una tabla con una fila por factura, para importar a otros programas. */}
        <a
          href={`/resumen/exportar?cliente=${cliente.id}&periodo=${periodo.mesAnio}`}
          download
          className="inline-flex h-11 items-center rounded-lg border border-[#C9D1DA] bg-surface px-4 text-sm font-semibold text-text no-underline hover:border-accent"
        >
          Exportar a CSV
        </a>
        <button
          type="button"
          disabled
          title="Pendiente: tarea D3"
          className="h-11 rounded-lg border border-[#C9D1DA] bg-surface px-4 text-sm font-semibold disabled:opacity-60"
        >
          Exportar a PDF
        </button>
      </div>
    </AppShell>
  );
}
