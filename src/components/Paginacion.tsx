import Link from "next/link";
import type { Pagina } from "@/lib/paginacion";

// Navegación entre páginas de un listado (B4). Conserva los demás parámetros de la URL (por ejemplo, el filtro
// de tipo en la bandeja). Sin más de una página solo muestra cuántas filas hay.
export function Paginacion({
  ruta,
  parametros = {},
  pagina,
  ancla,
  nombre = "facturas",
}: {
  ruta: string;
  parametros?: Record<string, string | undefined>;
  pagina: Pagina;
  ancla?: string; // #id al que debe volver la vista, por ejemplo "archivos"
  nombre?: string; // "facturas", "archivos", "claves"
}) {
  if (pagina.total === 0) return null;
  const enlace = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(parametros)) if (v) q.set(k, v);
    if (n > 1) q.set("pagina", String(n));
    const texto = q.toString();
    return `${ruta}${texto ? `?${texto}` : ""}${ancla ? `#${ancla}` : ""}`;
  };
  const boton = "inline-flex h-10 items-center rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold text-text no-underline";

  return (
    <nav aria-label={`Páginas de ${nombre}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <span className="text-sm text-text-muted">
        {pagina.desde}–{pagina.hasta} de {pagina.total} {nombre}
      </span>
      {pagina.paginas > 1 && (
        <div className="flex items-center gap-2">
          {pagina.pagina > 1 ? (
            <Link href={enlace(pagina.pagina - 1)} className={boton} rel="prev">
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className={`${boton} opacity-50`}>
              Anterior
            </span>
          )}
          <span className="text-sm" aria-current="page">
            Página {pagina.pagina} de {pagina.paginas}
          </span>
          {pagina.pagina < pagina.paginas ? (
            <Link href={enlace(pagina.pagina + 1)} className={boton} rel="next">
              Siguiente
            </Link>
          ) : (
            <span aria-disabled="true" className={`${boton} opacity-50`}>
              Siguiente
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
