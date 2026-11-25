import Link from "next/link";
import { TablaFacturas } from "@/components/TablaFacturas";
import type { FacturaListado } from "@/lib/datos";

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

// Resultados de la búsqueda. Cada fila lleva al detalle de la factura (pantalla de revisión).
export function ResultadosUuid({
  resultados,
  busqueda,
  limite,
  mostrarCliente = true,
}: {
  resultados: FacturaListado[];
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
      {resultados.length > 0 && <TablaFacturas facturas={resultados} mostrarCliente={mostrarCliente} />}
    </section>
  );
}
