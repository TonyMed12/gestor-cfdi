import Link from "next/link";
import type { ReactNode } from "react";
import { IconoFiltro, IconoFlecha } from "@/components/Iconos";

// Panel de filtros plegable: un botón «Filtros» con ícono despliega el formulario debajo, empujando el contenido
// (no flota encima de nada). Cerrado por defecto para no ocupar espacio; si hay filtros activos, el botón dice
// cuántos y a su lado se ven los aplicados, con un enlace para quitarlos. Usa <details>: funciona sin JavaScript
// y con teclado.
export function PanelFiltros({
  activos,
  quitarHref,
  children,
}: {
  activos: string[]; // descripción corta de cada filtro aplicado, por ejemplo "Desde $10,000"
  quitarHref: string;
  children: ReactNode;
}) {
  return (
    <details className="group flex flex-col">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span
          className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold ${
            activos.length > 0
              ? "border-accent bg-accent-soft text-accent-soft-text"
              : "border-[#8A96A3] bg-surface text-text"
          }`}
        >
          <IconoFiltro />
          Filtros
          {activos.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs text-white">
              {activos.length}
            </span>
          )}
          <IconoFlecha className="transition-transform group-open:rotate-180" />
        </span>
        {activos.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
            {activos.map((a) => (
              <span key={a} className="rounded-full bg-[#EEF1F4] px-2.5 py-1 text-[#374151]">
                {a}
              </span>
            ))}
            <Link href={quitarHref} className="ml-1 text-sm font-semibold">
              Quitar filtros
            </Link>
          </span>
        )}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
