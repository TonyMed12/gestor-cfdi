import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NOMBRE_APP } from "@/lib/config";
import { getCliente } from "@/lib/datos";
import { getFacturasPorCliente } from "@/lib/mock-data";

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
  por_confirmar: { text: "Por confirmar", variant: "warn" },
  por_revisar: { text: "Por revisar", variant: "warn" },
  clasificado: { text: "Clasificado", variant: "success" },
  excluido: { text: "Excluido", variant: "neutral" },
};

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  const cliente = await getCliente(clienteId);
  if (!cliente) notFound();
  const archivos = getFacturasPorCliente(clienteId);

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

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <h2 className="m-0 text-lg font-semibold">
          Subir facturas (RF-02, RF-04)
        </h2>
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#C9D1DA] bg-bg px-6 py-10 text-center">
          <p className="m-0 text-[15px] text-text-muted">
            Arrastra aquí los archivos XML, PDF, JPG, PNG o un ZIP con varios
            documentos.
          </p>
          <button
            type="button"
            className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
          >
            Elegir archivos
          </button>
          <p className="m-0 text-[13px] text-text-muted">
            El archivo original se conserva sin modificarse (RF-06). Límite
            propuesto: 20 MB por archivo (RNF-10).
          </p>
        </div>
      </section>

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4.5">
          <h2 className="m-0 text-lg font-semibold">Archivos del cliente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-text-muted">
                <th className="px-5 py-3 font-semibold">Emisor / receptor</th>
                <th className="px-3 py-3 font-semibold">Fecha</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {archivos.map((f) => {
                const estado = estadoLabel[f.estadoRevision];
                return (
                  <tr key={f.id} className="border-t border-[#EEF1F4]">
                    <td className="px-5 py-3.5 font-semibold">
                      {f.emisorNombre}
                    </td>
                    <td className="px-3 py-3.5">{f.fechaEmision}</td>
                    <td className="px-3 py-3.5 text-right font-mono text-sm">
                      ${f.total.toLocaleString("es-MX")}
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge variant={estado.variant}>{estado.text}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {f.estadoRevision === "por_revisar" ? (
                        <Link
                          href={`/revision/${f.id}`}
                          className="text-sm font-semibold"
                        >
                          Revisar
                        </Link>
                      ) : (
                        <span className="text-sm text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
