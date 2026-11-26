import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Paginacion } from "@/components/Paginacion";
import { TablaFacturas } from "@/components/TablaFacturas";
import { NOMBRE_APP } from "@/lib/config";
import { getCliente, getPerfil, getPeriodoCliente } from "@/lib/datos";
import { describirCierre } from "@/lib/cierre";
import { esMesAnio, nombreMes } from "@/lib/formato";
import { leerPagina } from "@/lib/paginacion";
import { ReconsultarPeriodo } from "../../AjustesCliente";

type Parametros = { params: Promise<{ clienteId: string; mesAnio: string }> };

export async function generateMetadata({ params }: Parametros) {
  const { clienteId, mesAnio } = await params;
  const cliente = await getCliente(clienteId);
  return { title: `${nombreMes(mesAnio)} · ${cliente?.razonSocial ?? "Cliente"} · ${NOMBRE_APP}` };
}

// Un periodo del cliente (C2): su estado, cuántas facturas tiene en cada estado de revisión y la lista de facturas.
export default async function PeriodoClientePage({
  params,
  searchParams,
}: Parametros & { searchParams: Promise<{ pagina?: string }> }) {
  const { clienteId, mesAnio } = await params;
  if (!esMesAnio(mesAnio)) notFound();
  const cliente = await getCliente(clienteId);
  if (!cliente) notFound();
  const { pagina: paginaPedida } = await searchParams;
  // B4: las facturas van de 10 en 10; los conteos son de todo el periodo.
  const [datos, perfil] = await Promise.all([getPeriodoCliente(cliente.id, mesAnio, leerPagina(paginaPedida)), getPerfil()]);
  if (!datos) notFound();
  const { periodo, facturas, pagina } = datos;
  // Solo administrador y contador actualizan facturas (RLS); el auxiliar no ve la consulta al SAT.
  const puedeEditar = perfil?.rol === "administrador" || perfil?.rol === "contador";

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
        {periodo.estado === "cerrado" && (
          <p className="m-0 text-sm font-semibold">{describirCierre(periodo.cerradoEn, periodo.cerradoPor)}</p>
        )}
        <Link
          href={`/resumen?cliente=${cliente.id}&periodo=${periodo.mesAnio}`}
          className="mt-2 inline-flex h-10 w-fit items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
        >
          Ver resumen del periodo
        </Link>
      </header>

      {puedeEditar && periodo.estado === "abierto" && (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
          <h2 className="m-0 text-lg font-semibold">Consulta al SAT</h2>
          <p className="m-0 text-sm text-text-muted">
            Antes de cerrar el periodo, vuelve a consultar al SAT sus facturas para detectar cancelaciones. Las
            canceladas salen del resumen con su motivo.
          </p>
          <ReconsultarPeriodo clienteId={cliente.id} mesAnio={periodo.mesAnio} />
        </section>
      )}

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
          <>
            <TablaFacturas facturas={facturas} mostrarCliente={false} />
            <Paginacion ruta={`/clientes/${cliente.id}/periodos/${periodo.mesAnio}`} pagina={pagina} />
          </>
        ) : (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">Este periodo no tiene facturas.</p>
        )}
      </section>
    </AppShell>
  );
}
