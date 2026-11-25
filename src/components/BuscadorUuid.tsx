import Link from "next/link";
import { Badge } from "@/components/Badge";
import { ESTADO_SAT } from "@/lib/catalogos-cfdi";
import type { ResultadoUuid } from "@/lib/datos";
import { dinero } from "@/lib/formato";

// Campo de búsqueda por folio fiscal (B1). Es un formulario GET: la búsqueda queda en la URL (?uuid=...).
export function BuscadorUuid({
  accion,
  valor,
  error,
}: {
  accion: string; // ruta de la página que busca
  valor: string;
  error?: string;
}) {
  return (
    <form role="search" action={accion} method="get" className="flex flex-col gap-1">
      <label htmlFor="buscar-uuid" className="text-sm font-semibold">
        Buscar por folio fiscal (UUID)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="buscar-uuid"
          name="uuid"
          type="search"
          defaultValue={valor}
          placeholder="Completo o una parte, por ejemplo 88149FA2"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "buscar-uuid-error" : undefined}
          className="h-10 min-w-[280px] flex-1 rounded-lg border border-[#8A96A3] bg-surface px-3 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Buscar
        </button>
        {valor && (
          <Link href={accion} className="text-sm font-semibold">
            Limpiar
          </Link>
        )}
      </div>
      {error && (
        <span id="buscar-uuid-error" role="alert" className="text-[13px] text-[#B42318]">
          {error}
        </span>
      )}
    </form>
  );
}

const ESTADO_REVISION: Record<string, { texto: string; variante: "success" | "warn" | "neutral" }> = {
  por_confirmar: { texto: "Por confirmar", variante: "warn" },
  por_revisar: { texto: "Por revisar", variante: "warn" },
  clasificado: { texto: "Aprobada", variante: "success" },
  excluido: { texto: "Excluida", variante: "neutral" },
};

// Resultados de la búsqueda. Cada fila lleva al detalle de la factura (pantalla de revisión).
export function ResultadosUuid({
  resultados,
  busqueda,
  limite,
  mostrarCliente = true,
}: {
  resultados: ResultadoUuid[];
  busqueda: string;
  limite: number;
  mostrarCliente?: boolean;
}) {
  return (
    <section aria-label="Resultados de la búsqueda" className="flex flex-col rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4.5">
        <h2 className="m-0 text-lg font-semibold">Resultados para «{busqueda}»</h2>
        <p className="m-0 text-sm text-text-muted">
          {resultados.length === 0
            ? "Ninguna factura tiene ese folio fiscal."
            : resultados.length === 1
              ? "1 factura, en cualquier estado de revisión."
              : `${resultados.length} facturas, en cualquier estado de revisión.`}
          {resultados.length >= limite && ` Se muestran las primeras ${limite}; escribe más caracteres para afinar.`}
        </p>
      </div>
      {resultados.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-text-muted">
                <th className="px-5 py-3 font-semibold">Folio fiscal</th>
                {mostrarCliente && <th className="px-3 py-3 font-semibold">Cliente</th>}
                <th className="px-3 py-3 font-semibold">Emisor / receptor</th>
                <th className="px-3 py-3 font-semibold">Fecha</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => {
                const revision = ESTADO_REVISION[r.estadoRevision] ?? { texto: r.estadoRevision, variante: "neutral" as const };
                const sat = r.estadoSat ? ESTADO_SAT[r.estadoSat] : undefined;
                return (
                  <tr key={r.id} className="border-t border-[#EEF1F4]">
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px]">{r.uuid}</td>
                    {mostrarCliente && (
                      <td className="px-3 py-3.5">
                        <Link href={`/clientes/${r.clienteId}`} className="text-sm">
                          {r.cliente}
                        </Link>
                      </td>
                    )}
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold">{r.contraparte}</span>
                        <span className="text-[13px] text-text-muted">
                          {r.relacion === "recibida" ? "Recibida" : "Emitida"} ·{" "}
                          <span className="font-mono">{r.contraparteRfc}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {new Date(r.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">{dinero(r.total, r.moneda)}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={revision.variante}>{revision.texto}</Badge>
                        {sat && <span className="text-[13px] text-text-muted">SAT: {sat.texto}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/revision/${r.id}`} className="text-sm font-semibold">
                        Ver factura
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
