import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NOMBRE_APP } from "@/lib/config";
import { getCategorias, getPerfil } from "@/lib/datos";
import { FormCategoria } from "./FormCategoria";

export const metadata = { title: `Categorías · ${NOMBRE_APP}` };

export default async function CategoriasPage() {
  const perfil = await getPerfil();
  const categorias = await getCategorias();
  const puedeEditar = perfil?.rol === "administrador" || perfil?.rol === "contador";

  return (
    <AppShell active="/categorias">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">{perfil?.despacho || "Sin despacho"}</span>
        <h1 className="m-0 text-[30px] font-bold">Categorías</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Grupos contables con los que se clasifican las facturas y se arma el resumen por periodo.
          La lista inicial es una propuesta: puedes editarla o agregar las que necesite tu despacho.
        </p>
      </header>

      {puedeEditar && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="m-0 mb-3.5 text-lg font-semibold">Agregar categoría</h2>
          <FormCategoria />
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              <th className="px-5 py-3.5 font-semibold">Categoría</th>
              <th className="px-3 py-3.5 font-semibold">Deducible por defecto</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className="border-t border-[#EEF1F4]">
                <td className="px-5 py-3.5 font-semibold">
                  {puedeEditar ? (
                    <details>
                      <summary className="cursor-pointer">{c.nombre}</summary>
                      <div className="mt-3 font-normal">
                        <FormCategoria categoria={c} />
                      </div>
                    </details>
                  ) : (
                    c.nombre
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <Badge variant={c.deducibleDefault ? "success" : "neutral"}>
                    {c.deducibleDefault ? "Sí" : "No"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categorias.length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
            Aún no hay categorías. Ejecuta el script 10-categorias-iniciales.sql en Supabase.
          </p>
        )}
      </section>
    </AppShell>
  );
}
