import { AppShell } from "@/components/AppShell";
import { NOMBRE_APP } from "@/lib/config";
import { getPeriodoActual, getResumenPeriodo } from "@/lib/mock-data";

export const metadata = { title: `Resumen del periodo · ${NOMBRE_APP}` };

// Pendiente: reemplazar por un selector de cliente.
const CLIENTE_ID = "";

export default function ResumenPage() {
  const resumen = getResumenPeriodo(CLIENTE_ID);
  const totales = resumen.porCategoria.reduce(
    (acc, r) => ({
      ingresos: acc.ingresos + r.ingresos,
      gastos: acc.gastos + r.gastos,
      ivaTrasladado: acc.ivaTrasladado + r.ivaTrasladado,
      ivaAcreditable: acc.ivaAcreditable + r.ivaAcreditable,
    }),
    { ingresos: 0, gastos: 0, ivaTrasladado: 0, ivaAcreditable: 0 },
  );

  return (
    <AppShell active="/resumen">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">
          Sin cliente seleccionado
        </span>
        <h1 className="m-0 text-[30px] font-bold">
          Resumen del periodo · {getPeriodoActual()}
        </h1>
        <p className="m-0 text-[15px] text-text-muted">
          {resumen.totalIncluidas} facturas clasificadas incluidas ·{" "}
          {resumen.totalExcluidas} excluidas
        </p>
      </header>

      <section
        aria-label="Totales del periodo"
        className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4"
      >
        <Tarjeta label="Ingresos" valor={totales.ingresos} />
        <Tarjeta label="Gastos" valor={totales.gastos} />
        <Tarjeta label="IVA trasladado" valor={totales.ivaTrasladado} />
        <Tarjeta label="IVA acreditable" valor={totales.ivaAcreditable} />
      </section>

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4.5">
          <h2 className="m-0 text-lg font-semibold">Por categoría</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-text-muted">
                <th className="px-5 py-3 font-semibold">Categoría</th>
                <th className="px-3 py-3 text-right font-semibold">
                  Ingresos
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  Gastos
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  IVA trasladado
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  IVA acreditable
                </th>
              </tr>
            </thead>
            <tbody>
              {resumen.porCategoria.map((r) => (
                <tr key={r.categoria} className="border-t border-[#EEF1F4]">
                  <td className="px-5 py-3.5 font-semibold">
                    {r.categoria}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-sm">
                    {r.ingresos > 0
                      ? `$${r.ingresos.toLocaleString("es-MX")}`
                      : "—"}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-sm">
                    {r.gastos > 0
                      ? `$${r.gastos.toLocaleString("es-MX")}`
                      : "—"}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-sm">
                    ${r.ivaTrasladado.toLocaleString("es-MX")}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-sm">
                    ${r.ivaAcreditable.toLocaleString("es-MX")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5.5">
        <h2 className="m-0 text-lg font-semibold">
          Excluidas del resumen (RF-40)
        </h2>
        {resumen.excluidas.length === 0 ? (
          <p className="m-0 text-sm text-text-muted">
            No hay facturas excluidas en este periodo.
          </p>
        ) : (
          <ul className="m-0 flex flex-col gap-2 p-0 text-[15px]">
            {resumen.excluidas.map((e, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FFF6E6] px-3.5 py-2.5"
              >
                <span>{e.descripcion}</span>
                <span className="text-sm font-semibold text-warn-soft-text">
                  {e.motivo}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="h-11 rounded-lg border border-[#C9D1DA] bg-surface px-4 text-sm font-semibold"
        >
          Exportar a Excel/CSV
        </button>
        <button
          type="button"
          className="h-11 rounded-lg border border-[#C9D1DA] bg-surface px-4 text-sm font-semibold"
        >
          Exportar a PDF
        </button>
        <button
          type="button"
          className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Cerrar periodo
        </button>
      </div>
    </AppShell>
  );
}

function Tarjeta({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-5">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="font-mono text-2xl font-bold">
        ${valor.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}
