import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NOMBRE_APP } from "@/lib/config";
import { getCliente, getPeriodosCliente } from "@/lib/datos";
import { nombreMes } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const cliente = await getCliente(clienteId);
  return { title: `Periodos · ${cliente?.razonSocial ?? "Cliente"} · ${NOMBRE_APP}` };
}

// Periodos mensuales del cliente (C2): estado y número de facturas de cada uno.
export default async function PeriodosClientePage({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const cliente = await getCliente(clienteId);
  if (!cliente) notFound();
  const periodos = await getPeriodosCliente(cliente.id);
  const abiertos = periodos.filter((p) => p.estado === "abierto").length;

  return (
    <AppShell active="/clientes">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">
          <Link href="/clientes">Clientes</Link> / <Link href={`/clientes/${cliente.id}`}>{cliente.razonSocial}</Link> /
          Periodos
        </span>
        <h1 className="m-0 text-[30px] font-bold">Periodos de {cliente.razonSocial}</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Cada factura pertenece al periodo del mes de su fecha de emisión. El periodo se crea solo al llegar su
          primera factura.
        </p>
        <p className="m-0 text-sm text-text-muted">
          {periodos.length === 1 ? "1 periodo" : `${periodos.length} periodos`} · {abiertos}{" "}
          {abiertos === 1 ? "abierto" : "abiertos"} · {periodos.length - abiertos}{" "}
          {periodos.length - abiertos === 1 ? "cerrado" : "cerrados"}
        </p>
      </header>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[760px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              <th className="px-5 py-3.5 font-semibold">Periodo</th>
              <th className="px-3 py-3.5 font-semibold">Estado</th>
              <th className="px-3 py-3.5 text-right font-semibold">Facturas</th>
              <th className="px-3 py-3.5 text-right font-semibold">Por revisar</th>
              <th className="px-3 py-3.5 text-right font-semibold">Aprobadas</th>
              <th className="px-3 py-3.5 text-right font-semibold">Excluidas</th>
              <th className="px-5 py-3.5">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id} className="border-t border-[#EEF1F4]">
                <td className="px-5 py-3.5">
                  <Link href={`/clientes/${cliente.id}/periodos/${p.mesAnio}`} className="font-semibold capitalize">
                    {nombreMes(p.mesAnio)}
                  </Link>
                </td>
                <td className="px-3 py-3.5">
                  {p.estado === "abierto" ? (
                    <Badge variant="success">Abierto</Badge>
                  ) : (
                    <div className="flex flex-col items-start gap-1">
                      <Badge>Cerrado</Badge>
                      {p.cerradoEn && (
                        <span className="text-[13px] text-text-muted">
                          {new Date(p.cerradoEn).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "America/Mexico_City",
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3.5 text-right font-semibold">{p.facturas}</td>
                <td className="px-3 py-3.5 text-right">{p.conteo.porRevisar + p.conteo.porConfirmar}</td>
                <td className="px-3 py-3.5 text-right">{p.conteo.aprobadas}</td>
                <td className="px-3 py-3.5 text-right">{p.conteo.excluidas}</td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={`/clientes/${cliente.id}/periodos/${p.mesAnio}`}
                    aria-label={`Ver el periodo de ${nombreMes(p.mesAnio)}`}
                    className="text-sm font-semibold"
                  >
                    Ver periodo
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {periodos.length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
            Este cliente aún no tiene periodos. Se crean al subir su primera factura.
          </p>
        )}
      </section>
    </AppShell>
  );
}
