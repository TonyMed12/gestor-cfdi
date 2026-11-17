import { AppShell } from "@/components/AppShell";
import { NOMBRE_APP } from "@/lib/config";
import { getCategorias, getClavesEnUso, getPerfil } from "@/lib/datos";
import { SelectorCategoria } from "./SelectorCategoria";

export const metadata = { title: `Claves del SAT · ${NOMBRE_APP}` };

export default async function ClavesPage() {
  const perfil = await getPerfil();
  const [claves, categorias] = await Promise.all([getClavesEnUso(), getCategorias()]);
  const puedeEditar = perfil?.rol === "administrador" || perfil?.rol === "contador";
  const sinCategoria = claves.filter((c) => c.categoriaId === null).length;

  return (
    <AppShell active="/claves">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">{perfil?.despacho || "Sin despacho"}</span>
        <h1 className="m-0 text-[30px] font-bold">Claves del SAT en tus facturas</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Cada concepto de una factura trae una clave del SAT. Elige a qué categoría pertenece cada
          una. Las facturas nuevas con esa clave se clasifican solas, y las que ya existen se actualizan.
        </p>
        <p className="m-0 text-sm text-text-muted">
          {claves.length} claves en uso · {sinCategoria} sin categoría
        </p>
      </header>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              <th className="px-5 py-3.5 font-semibold">Clave</th>
              <th className="px-3 py-3.5 font-semibold">Descripción del SAT</th>
              <th className="px-3 py-3.5 font-semibold">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {claves.map((c) => (
              <tr key={c.clave} className="border-t border-[#EEF1F4]">
                <td className="px-5 py-3.5 font-mono text-sm">{c.clave}</td>
                <td className="px-3 py-3.5">{c.descripcion}</td>
                <td className="px-3 py-3.5">
                  {puedeEditar ? (
                    <SelectorCategoria
                      clave={c.clave}
                      categoriaId={c.categoriaId}
                      sugerida={c.porDefecto}
                      opciones={categorias.map((k) => ({ id: k.id, nombre: k.nombre }))}
                    />
                  ) : (
                    categorias.find((k) => k.id === c.categoriaId)?.nombre ?? "Sin categoría"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {claves.length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
            Aún no hay facturas con conceptos. Cuando subas XML, sus claves aparecerán aquí.
          </p>
        )}
      </section>
    </AppShell>
  );
}
