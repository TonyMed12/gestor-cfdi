import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NOMBRE_APP } from "@/lib/config";
import { getCliente, getClientes, getResumenPeriodo } from "@/lib/datos";
import { dinero, esMesAnio, nombreMes } from "@/lib/formato";

export const metadata = { title: `Resumen del periodo · ${NOMBRE_APP}` };

const pesos = (n: number) => dinero(String(n), "MXN");

// Resumen de un cliente en un periodo (C3): /resumen?cliente=<id>&periodo=AAAA-MM.
// Se llega desde Clientes → Ver periodos → un periodo → Ver resumen. El selector en esta pantalla es la tarea C6.
export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; periodo?: string }>;
}) {
  const { cliente: clienteId, periodo: mesAnio } = await searchParams;
  const cliente = clienteId && /^[0-9a-f-]{36}$/i.test(clienteId) ? await getCliente(clienteId) : undefined;
  const datos = cliente && mesAnio && esMesAnio(mesAnio) ? await getResumenPeriodo(cliente.id, mesAnio) : undefined;

  if (!cliente || !datos) {
    const clientes = await getClientes();
    return (
      <AppShell active="/resumen">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[30px] font-bold">Resumen del periodo</h1>
          <p className="m-0 text-[15px] text-text-muted">
            {clienteId || mesAnio
              ? "No se encontró ese cliente o ese periodo. Elige uno de la lista."
              : "Elige un cliente y luego uno de sus periodos para ver su resumen."}
          </p>
        </header>
        <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {clientes.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}/periodos`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 no-underline hover:border-accent focus-visible:border-accent"
            >
              <span className="font-semibold text-text">{c.razonSocial}</span>
              <span className="font-mono text-sm text-text-muted">{c.rfc}</span>
              <span className="text-sm font-semibold">Ver sus periodos</span>
            </Link>
          ))}
          {clientes.length === 0 && <p className="m-0 text-sm text-text-muted">Aún no hay clientes.</p>}
        </section>
      </AppShell>
    );
  }

  const { periodo, resumen, excluidas } = datos;
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
        <p className="m-0 text-sm text-text-muted">
          {resumen.incluidas === 1 ? "1 factura incluida" : `${resumen.incluidas} facturas incluidas`} ·{" "}
          {excluidas.length === 1 ? "1 fuera del resumen" : `${excluidas.length} fuera del resumen`}. Solo cuentan las
          facturas aprobadas que no están canceladas.
        </p>
      </header>

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
            Importes antes de impuestos. Las notas de crédito restan. Un gasto es deducible si así se marcó la factura en
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
                  <tr key={`${f.tipo}-${f.categoria}`} className="border-t border-[#EEF1F4]">
                    <td className="px-5 py-3.5">
                      <Badge variant={f.tipo === "Ingreso" ? "success" : "neutral"}>{f.tipo}</Badge>
                    </td>
                    <td className="px-3 py-3.5 font-semibold">{f.categoria}</td>
                    <td className="px-3 py-3.5 text-right">{f.facturas}</td>
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

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5.5">
        <h2 className="m-0 text-lg font-semibold">Fuera del resumen</h2>
        {excluidas.length === 0 ? (
          <p className="m-0 text-sm text-text-muted">Todas las facturas del periodo están incluidas.</p>
        ) : (
          <ul className="m-0 flex flex-col gap-2 p-0 text-[15px]">
            {excluidas.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FFF6E6] px-3.5 py-2.5"
              >
                <Link href={`/revision/${e.id}`} className="text-text">
                  {e.descripcion}
                </Link>
                <span className="text-sm font-semibold text-warn-soft-text">{e.motivo}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          title="Pendiente: tarea D1"
          className="h-11 rounded-lg border border-[#C9D1DA] bg-surface px-4 text-sm font-semibold disabled:opacity-60"
        >
          Exportar a Excel/CSV
        </button>
        <button
          type="button"
          disabled
          title="Pendiente: tarea D3"
          className="h-11 rounded-lg border border-[#C9D1DA] bg-surface px-4 text-sm font-semibold disabled:opacity-60"
        >
          Exportar a PDF
        </button>
        <button
          type="button"
          disabled
          title="Pendiente: tarea D4"
          className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          Cerrar periodo
        </button>
      </div>
    </AppShell>
  );
}
