import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NOMBRE_APP } from "@/lib/config";
import { getFacturasPorRevisar } from "@/lib/mock-data";

export const metadata = { title: `Bandeja de revisión · ${NOMBRE_APP}` };

export default function BandejaPage() {
  const facturas = getFacturasPorRevisar();
  const porIa = facturas.filter((f) => f.origenClasificacion === "ia").length;
  const porRegla = facturas.filter(
    (f) => f.origenClasificacion === "regla",
  ).length;

  return (
    <AppShell active="/bandeja">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">
          Todos los clientes · octubre 2026
        </span>
        <h1 className="m-0 text-[30px] font-bold">Bandeja de revisión</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Ninguna clasificación queda firme hasta que la apruebes. Ordenada
          por prioridad.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filtrar por origen"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="h-10 rounded-full border border-accent bg-accent px-3.5 text-sm font-semibold text-white"
          >
            Todas · {facturas.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className="h-10 rounded-full border border-[#C9D1DA] bg-surface px-3.5 text-sm"
          >
            Sugerencia de IA · {porIa}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className="h-10 rounded-full border border-[#C9D1DA] bg-surface px-3.5 text-sm"
          >
            Por regla · {porRegla}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          Cliente
          <select className="h-10 rounded-lg border border-[#C9D1DA] bg-surface px-2.5 text-sm">
            <option>Todos los clientes</option>
          </select>
        </label>
      </div>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[980px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              <th className="px-5 py-3.5 font-semibold">Prioridad</th>
              <th className="px-3 py-3.5 font-semibold">
                Emisor / receptor
              </th>
              <th className="px-3 py-3.5 font-semibold">Fecha</th>
              <th className="px-3 py-3.5 text-right font-semibold">Total</th>
              <th className="px-3 py-3.5 font-semibold">SAT</th>
              <th className="px-3 py-3.5 font-semibold">
                Clasificación propuesta
              </th>
              <th className="px-3 py-3.5 font-semibold">Origen</th>
              <th className="px-5 py-3.5">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((f, i) => (
              <tr
                key={f.id}
                className={`border-t border-[#EEF1F4] ${
                  i === 0 ? "bg-[#F3FAF8]" : ""
                }`}
              >
                <td className="px-5 py-3.5">
                  {f.prioridad === "alta" ? (
                    <div className="flex flex-col gap-1">
                      <Badge variant="warn">Alta</Badge>
                      <span className="text-[13px] text-text-muted">
                        {f.motivoPrioridad}
                      </span>
                    </div>
                  ) : (
                    <Badge>Normal</Badge>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{f.emisorNombre}</span>
                    <span className="text-[13px] text-text-muted">
                      {f.relacion === "recibida" ? "Recibida" : "Emitida"} ·{" "}
                      <span className="font-mono">
                        {f.relacion === "recibida"
                          ? f.emisorRfc
                          : f.receptorRfc}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  {new Date(f.fechaEmision).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-sm">
                  ${f.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-3.5">
                  <Badge variant="success">Vigente</Badge>
                </td>
                <td className="px-3 py-3.5">{f.categoriaPropuesta}</td>
                <td className="px-3 py-3.5">
                  {f.origenClasificacion === "ia" ? (
                    <span className="text-[13px] font-semibold text-sat-soft-text">
                      IA · {f.sugerencia?.confianza}%
                    </span>
                  ) : (
                    <span className="text-[13px] text-[#374151]">
                      Regla del contador
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <Link
                    href={`/revision/${f.id}`}
                    className={
                      i === 0
                        ? "inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
                        : "text-sm font-semibold"
                    }
                  >
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {facturas.length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
            No hay facturas por revisar.
          </p>
        )}
      </section>
      <p className="m-0 text-sm text-text-muted">
        Primero se aplican tus reglas; la IA solo propone cuando ninguna
        regla aplica.
      </p>
    </AppShell>
  );
}
