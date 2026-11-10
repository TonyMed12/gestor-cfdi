import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { ESTADO_SAT } from "@/lib/catalogos-cfdi";
import { NOMBRE_APP } from "@/lib/config";
import { getArchivos, getCliente } from "@/lib/datos";
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
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  const cliente = await getCliente(clienteId);
  if (!cliente) notFound();
  const archivos = await getArchivos(clienteId);

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
      </header>

      <SubirArchivos clienteId={cliente.id} />

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4.5">
          <h2 className="m-0 text-lg font-semibold">Archivos del cliente</h2>
        </div>
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
                          {Number(a.factura.total).toLocaleString("es-MX", { style: "currency", currency: a.factura.moneda })} ·{" "}
                          <span className="font-mono">{a.factura.uuid.slice(0, 8)}</span> · SAT:{" "}
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
                      {a.tipo === "xml" ? (
                        <Link href={`/clientes/${cliente.id}/archivos/${a.id}`} className="text-sm font-semibold">
                          Ver
                        </Link>
                      ) : (
                        <VerArchivo ruta={a.ruta} />
                      )}
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
      </section>
    </AppShell>
  );
}
