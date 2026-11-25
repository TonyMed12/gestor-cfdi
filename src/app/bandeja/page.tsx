import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { BuscadorUuid, ResultadosUuid } from "@/components/BuscadorUuid";
import { Paginacion } from "@/components/Paginacion";
import { interpretarBusquedaUuid } from "@/lib/busqueda";
import { leerPagina } from "@/lib/paginacion";
import { NOMBRE_APP } from "@/lib/config";
import {
  buscarFacturasPorUuid,
  getClientes,
  getFacturasPorRevisar,
  getPerfil,
  getPeriodosPorCliente,
  LIMITE_RESULTADOS_UUID,
} from "@/lib/datos";
import { aParametros, hayFiltros, leerFiltros, type Parametros } from "@/lib/filtros";
import { getPeriodoActual } from "@/lib/mock-data";
import { AprobacionEnLote } from "./AprobacionEnLote";
import { FiltrosBandeja } from "./FiltrosBandeja";

export const metadata = { title: `Bandeja de revisión · ${NOMBRE_APP}` };

const etiquetaSat = {
  vigente: <Badge variant="success">Vigente</Badge>,
  cancelada: <Badge variant="warn">Cancelada</Badge>,
  no_encontrada: <Badge>No encontrada</Badge>,
} as const;

const TIPOS = [
  { codigo: "", etiqueta: "Todos los tipos" },
  { codigo: "I", etiqueta: "Ingreso" },
  { codigo: "E", etiqueta: "Egreso" },
  { codigo: "T", etiqueta: "Traslado" },
  { codigo: "P", etiqueta: "Pago" },
  { codigo: "N", etiqueta: "Nómina" },
];

// /bandeja con los filtros dados (sin vacíos). Cambiar de tipo vuelve a la primera página.
const enlaceBandeja = (parametros: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros)) if (v) q.set(k, v);
  const texto = q.toString();
  return texto ? `/bandeja?${texto}` : "/bandeja";
};

export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<Parametros & { uuid?: string; pagina?: string }>;
}) {
  const { uuid, pagina, ...parametros } = await searchParams;
  const textoBusqueda = (uuid ?? "").trim();
  const busqueda = interpretarBusquedaUuid(textoBusqueda);
  const buscador = (
    <BuscadorUuid
      accion="/bandeja"
      valor={textoBusqueda}
      error={busqueda.tipo === "invalida" ? busqueda.error : undefined}
    />
  );

  // Con una búsqueda válida, la bandeja muestra solo los resultados (en cualquier estado de revisión).
  if (busqueda.tipo === "completo" || busqueda.tipo === "fragmento") {
    const resultados = await buscarFacturasPorUuid(busqueda);
    return (
      <AppShell active="/bandeja">
        <header className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Todos los clientes</span>
          <h1 className="m-0 text-[30px] font-bold">Bandeja de revisión</h1>
        </header>
        {buscador}
        <ResultadosUuid resultados={resultados} busqueda={textoBusqueda.toUpperCase()} limite={LIMITE_RESULTADOS_UUID} />
      </AppShell>
    );
  }

  // B2: filtros generales de la URL, validados. B4: de 50 en 50, en el orden elegido entre todas las que coinciden.
  const { filtros, avisos } = leerFiltros(parametros);
  const tipoActivo = filtros.tipo ?? "";
  const [bandeja, perfil, clientes, periodosPorCliente] = await Promise.all([
    getFacturasPorRevisar({ filtros, pagina: leerPagina(pagina) }),
    getPerfil(),
    getClientes(),
    getPeriodosPorCliente(),
  ]);
  // Solo administrador y contador aprueban (RN-05); el auxiliar ve la bandeja sin casillas.
  const puedeDecidir = perfil?.rol === "administrador" || perfil?.rol === "contador";
  const { facturas, porIa, porRegla } = bandeja;
  // Periodos para el filtro: los del cliente elegido o, sin cliente, todos los meses del despacho.
  const periodos = [
    ...new Set(
      (filtros.cliente ? (periodosPorCliente[filtros.cliente] ?? []) : Object.values(periodosPorCliente).flat()).map(
        (p) => p.mesAnio,
      ),
    ),
  ].sort((a, b) => b.localeCompare(a));
  const conFiltros = hayFiltros(filtros);

  return (
    <AppShell active="/bandeja">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">
          Todos los clientes · {getPeriodoActual()}
        </span>
        <h1 className="m-0 text-[30px] font-bold">Bandeja de revisión</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Ninguna clasificación queda firme hasta que la apruebes.{" "}
          {filtros.orden === "prioridad" ? "Ordenada por prioridad." : "Ordenada como elegiste en los filtros."}
        </p>
      </header>

      {buscador}

      <FiltrosBandeja
        filtros={filtros}
        clientes={clientes.map((c) => ({ id: c.id, razonSocial: c.razonSocial }))}
        periodos={periodos}
        avisos={avisos}
      />

      <nav aria-label="Filtrar por tipo de comprobante" className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <Link
            key={t.codigo || "todos"}
            href={enlaceBandeja({ ...aParametros(filtros), tipo: t.codigo || undefined })}
            aria-current={t.codigo === tipoActivo ? "page" : undefined}
            className={`h-9 inline-flex items-center rounded-full border px-3 text-sm no-underline ${
              t.codigo === tipoActivo ? "border-accent bg-accent font-semibold text-white" : "border-[#C9D1DA] bg-surface"
            }`}
          >
            {t.etiqueta}
          </Link>
        ))}
      </nav>

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
            {conFiltros ? "Con estos filtros" : "Todas"} · {bandeja.pagina.total}
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
      </div>

      <AprobacionEnLote activo={puedeDecidir && facturas.length > 0}>
      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[1020px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              {puedeDecidir && facturas.length > 0 && (
                <th className="w-12 py-3.5 pl-5">
                  <input type="checkbox" name="todas" aria-label="Seleccionar todas las facturas de esta página" className="h-4 w-4" />
                </th>
              )}
              <th className={`${puedeDecidir && facturas.length > 0 ? "px-3" : "px-5"} py-3.5 font-semibold`}>Prioridad</th>
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
                {puedeDecidir && (
                  <td className="py-3.5 pl-5">
                    <input
                      type="checkbox"
                      name="factura"
                      value={f.id}
                      aria-label={`Seleccionar la factura de ${f.emisorNombre}`}
                      className="h-4 w-4"
                    />
                  </td>
                )}
                <td className={`${puedeDecidir ? "px-3" : "px-5"} py-3.5`}>
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
                  {etiquetaSat[f.estadoSat]}
                </td>
                <td className="px-3 py-3.5">{f.categoriaPropuesta}</td>
                <td className="px-3 py-3.5">
                  {f.origenClasificacion === "ia" ? (
                    <span className="text-[13px] font-semibold text-sat-soft-text">
                      IA · {f.sugerencia?.confianza}%
                    </span>
                  ) : f.origenClasificacion === "emisor" ? (
                    <span className="text-[13px] text-[#374151]">
                      Regla por emisor
                    </span>
                  ) : f.origenClasificacion === "base" ? (
                    <span className="text-[13px] text-[#374151]">
                      Regla base (palabra clave)
                    </span>
                  ) : f.origenClasificacion === "regla" ? (
                    <span className="text-[13px] text-[#374151]">
                      Clave asignada a mano
                    </span>
                  ) : f.origenClasificacion === "division" ? (
                    <span className="text-[13px] text-[#374151]">
                      Clave del SAT (sugerida)
                    </span>
                  ) : (
                    <span className="text-[13px] text-text-muted">Sin origen</span>
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
            {conFiltros ? "Ninguna factura por revisar coincide con estos filtros." : "No hay facturas por revisar."}
          </p>
        )}
      </section>
      <Paginacion ruta="/bandeja" parametros={aParametros(filtros)} pagina={bandeja.pagina} />
      </AprobacionEnLote>
      <p className="m-0 text-sm text-text-muted">
        Cada concepto se clasifica en este orden: clave asignada a mano,
        regla por emisor, regla base y, por último, sugerencia de la clave del SAT.
        En facturas emitidas solo se proponen categorías de ingreso.
      </p>
    </AppShell>
  );
}
