import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { NOMBRE_APP } from "@/lib/config";
import { getClientes, getPerfil } from "@/lib/datos";
import { getPeriodoActual } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";

export const metadata = { title: `Tablero · ${NOMBRE_APP}` };

const armarResumen = (clientes: Cliente[]) => [
  {
    label: "Archivos sin leer",
    valor: clientes.reduce((s, c) => s + c.sinLeer, 0),
    nota: "Se están leyendo ahora",
  },
  {
    label: "Por revisar",
    valor: clientes.reduce((s, c) => s + c.porRevisar, 0),
    nota: "Esperan tu aprobación",
    destacado: true,
  },
  {
    label: "Con error",
    valor: clientes.reduce((s, c) => s + c.conError, 0),
    nota: "Todo se pudo leer",
  },
  {
    label: "XML faltantes",
    valor: clientes.reduce((s, c) => s + c.faltantes, 0),
    nota: "Ya se avisó al cliente",
  },
];

export default async function DashboardPage() {
  const perfil = await getPerfil();
  const clientes = await getClientes();
  const resumen = armarResumen(clientes);

  return (
    <AppShell active="/dashboard">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">
            {perfil?.despacho || "Sin despacho"} · Periodo abierto: {getPeriodoActual()}
          </span>
          <h1 className="m-0 text-[30px] font-bold">
            Pendientes por cliente
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE3EA] font-semibold">
            {(perfil?.nombre ?? "").slice(0, 2).toUpperCase()}
          </span>
          <div className="flex flex-col">
            <span className="font-semibold">{perfil?.nombre}</span>
            <span className="text-text-muted capitalize">{perfil?.rol}</span>
          </div>
        </div>
      </header>

      <section
        aria-label="Resumen de pendientes"
        className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4"
      >
        {resumen.map((r) => (
          <div
            key={r.label}
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-5"
          >
            <span className="text-sm text-text-muted">{r.label}</span>
            <span
              className={`text-[32px] font-bold ${
                r.destacado ? "text-warn-soft-text" : ""
              }`}
            >
              {r.valor}
            </span>
            <span className="text-[13px] text-text-muted">{r.nota}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4.5">
          <h2 className="m-0 text-lg font-semibold">Clientes asignados</h2>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Buscar
            <input
              type="search"
              placeholder="Nombre o RFC"
              className="h-10 w-55 rounded-lg border border-[#C9D1DA] px-3"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-text-muted">
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-3 py-3 font-semibold">RFC</th>
                <th className="px-3 py-3 text-right font-semibold">
                  Sin leer
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  Por revisar
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  Con error
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  Faltantes
                </th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => {
                const alDia =
                  c.sinLeer + c.porRevisar + c.conError + c.faltantes === 0;
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-[#EEF1F4] ${
                      i === 0 ? "bg-[#F3FAF8]" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-semibold">
                      {c.razonSocial}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-sm">
                      {c.rfc}
                    </td>
                    <td className="px-3 py-3.5 text-right">{c.sinLeer}</td>
                    <td className="px-3 py-3.5 text-right">
                      {c.porRevisar}
                    </td>
                    <td className="px-3 py-3.5 text-right">{c.conError}</td>
                    <td className="px-3 py-3.5 text-right">
                      {c.faltantes}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      {alDia ? (
                        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent-soft-text">
                          Al día
                        </span>
                      ) : i === 0 ? (
                        <Link
                          href={`/clientes/${c.id}`}
                          className="inline-flex h-10 items-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
                        >
                          Abrir repositorio
                        </Link>
                      ) : (
                        <Link
                          href={`/clientes/${c.id}`}
                          className="text-sm font-semibold"
                        >
                          Abrir
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {clientes.length === 0 && (
            <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
              Aún no hay clientes.
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
