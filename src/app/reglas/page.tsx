import { AppShell } from "@/components/AppShell";
import { NOMBRE_APP } from "@/lib/config";
import { getCategorias, getPerfil, getReglasEmisor } from "@/lib/datos";
import { BotonBorrarRegla, FormRegla } from "./FormRegla";

export const metadata = { title: `Reglas · ${NOMBRE_APP}` };

export default async function ReglasPage() {
  const perfil = await getPerfil();
  const [reglas, categorias] = await Promise.all([getReglasEmisor(), getCategorias()]);
  const puedeEditar = perfil?.rol === "administrador" || perfil?.rol === "contador";

  return (
    <AppShell active="/reglas">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">{perfil?.despacho || "Sin despacho"}</span>
        <h1 className="m-0 text-[30px] font-bold">Reglas por emisor</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Úsala para un proveedor (o cliente) que siempre cae en la misma categoría. Cada concepto de
          sus facturas que no tenga una clave asignada a mano va a esa categoría. Si una clave ya
          tiene categoría asignada a mano, esa gana. En facturas recibidas el RFC es el del proveedor;
          en emitidas, el del cliente que recibe la factura.
        </p>
      </header>

      {puedeEditar && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="m-0 mb-3.5 text-lg font-semibold">Nueva regla</h2>
          <FormRegla opciones={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))} />
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              <th className="px-5 py-3.5 font-semibold">RFC</th>
              <th className="px-3 py-3.5 font-semibold">Categoría</th>
              {puedeEditar && (
                <th className="px-5 py-3.5">
                  <span className="sr-only">Acción</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {reglas.map((r) => (
              <tr key={r.rfc} className="border-t border-[#EEF1F4]">
                <td className="px-5 py-3.5 font-mono text-sm">{r.rfc}</td>
                <td className="px-3 py-3.5">{r.categoria}</td>
                {puedeEditar && (
                  <td className="px-5 py-3.5 text-right">
                    <BotonBorrarRegla rfc={r.rfc} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {reglas.length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
            Aún no hay reglas. Agrega una arriba para el proveedor que siempre cae en la misma categoría.
          </p>
        )}
      </section>
    </AppShell>
  );
}
