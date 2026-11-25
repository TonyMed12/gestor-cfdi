import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { TablaFacturas } from "@/components/TablaFacturas";
import { NOMBRE_APP } from "@/lib/config";
import { getCliente, getPeriodoCliente } from "@/lib/datos";
import { esMesAnio, nombreMes } from "@/lib/formato";

type Parametros = { params: Promise<{ clienteId: string; mesAnio: string }> };

export async function generateMetadata({ params }: Parametros) {
  const { clienteId, mesAnio } = await params;
  const cliente = await getCliente(clienteId);
  return { title: `${nombreMes(mesAnio)} · ${cliente?.razonSocial ?? "Cliente"} · ${NOMBRE_APP}` };
}

// Un periodo del cliente (C2): su estado, cuántas facturas tiene en cada estado de revisión y la lista de facturas.
export default async function PeriodoClientePage({ params }: Parametros) {
  const { clienteId, mesAnio } = await params;
  if (!esMesAnio(mesAnio)) notFound();
  const cliente = await getCliente(clienteId);
  if (!cliente) notFound();
  const datos = await getPeriodoCliente(cliente.id, mesAnio);
  if (!datos) notFound();
  const { periodo, facturas } = datos;

  const tarjetas = [
    { etiqueta: "Facturas", valor: periodo.facturas },
    { etiqueta: "Por revisar", valor: periodo.conteo.porRevisar + periodo.conteo.porConfirmar },
    { etiqueta: "Aprobadas", valor: periodo.conteo.aprobadas },
    { etiqueta: "Excluidas", valor: periodo.conteo.excluidas },
  ];

  return (
    <AppShell active="/clientes">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">
          <Link href="/clientes">Clientes</Link> / <Link href={`/clientes/${cliente.id}`}>{cliente.razonSocial}</Link> /{" "}
          <Link href={`/clientes/${cliente.id}/periodos`}>Periodos</Link> / {nombreMes(periodo.mesAnio)}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-[30px] font-bold capitalize">{nombreMes(periodo.mesAnio)}</h1>
          {periodo.estado === "abierto" ? <Badge variant="success">Abierto</Badge> : <Badge>Cerrado</Badge>}
        </div>
        <p className="m-0 text-[15px] text-text-muted">
          {cliente.razonSocial} · <span className="font-mono text-sm">{cliente.rfc}</span>
        </p>
      </header>

      <section aria-label="Facturas del periodo por estado" className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {tarjetas.map((t) => (
          <div key={t.etiqueta} className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-5">
            <span className="text-sm text-text-muted">{t.etiqueta}</span>
            <span className="text-[26px] font-bold">{t.valor}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4.5">
          <h2 className="m-0 text-lg font-semibold">Facturas del periodo</h2>
          <p className="m-0 text-sm text-text-muted">
            Todas las facturas emitidas en este mes, en cualquier estado de revisión.
          </p>
        </div>
        {facturas.length > 0 ? (
          <TablaFacturas facturas={facturas} mostrarCliente={false} />
        ) : (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">Este periodo no tiene facturas.</p>
        )}
      </section>
    </AppShell>
  );
}
