import Link from "next/link";
import { Badge } from "@/components/Badge";
import { ESTADO_SAT } from "@/lib/catalogos-cfdi";
import type { FacturaListado } from "@/lib/datos";
import { dinero } from "@/lib/formato";

const ESTADO_REVISION: Record<string, { texto: string; variante: "success" | "warn" | "neutral" }> = {
  por_confirmar: { texto: "Por confirmar", variante: "warn" },
  por_revisar: { texto: "Por revisar", variante: "warn" },
  clasificado: { texto: "Aprobada", variante: "success" },
  excluido: { texto: "Excluida", variante: "neutral" },
};

// Tabla de facturas para listados (búsqueda por folio, facturas de un periodo).
// Cada fila lleva al detalle de la factura (pantalla de revisión).
export function TablaFacturas({
  facturas,
  mostrarCliente = true,
}: {
  facturas: FacturaListado[];
  mostrarCliente?: boolean;
}) {
  return (
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
          {facturas.map((r) => {
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
                  {new Date(r.fecha).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "America/Mexico_City",
                  })}
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
  );
}
