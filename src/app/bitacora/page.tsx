import { AppShell } from "@/components/AppShell";
import { Paginacion } from "@/components/Paginacion";
import { clientesEnDetalles, describirDetalle } from "@/lib/bitacora-texto";
import { NOMBRE_APP } from "@/lib/config";
import { getPerfil } from "@/lib/datos";
import { describirPagina, leerPagina, rangoDePagina } from "@/lib/paginacion";
import { supabaseServidor } from "@/lib/supabase-servidor";

export const metadata = { title: `Bitácora · ${NOMBRE_APP}` };

const ACCIONES: Record<string, string> = {
  subio: "Subió un archivo",
  aprobo: "Aprobó la clasificación",
  corrigio: "Corrigió o rechazó",
  exporto: "Exportó",
  cerro_periodo: "Cerró un periodo",
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

export default async function BitacoraPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol !== "administrador") {
    return (
      <AppShell active="/bitacora">
        <h1 className="m-0 text-[30px] font-bold">Bitácora</h1>
        <p className="m-0 text-[15px] text-text-muted">Solo el administrador puede consultar la bitácora.</p>
      </AppShell>
    );
  }

  const supabase = await supabaseServidor();
  // De 10 en 10 como los demás listados (B4). Primero cuántos registros hay, para ajustar una página que ya no existe; luego solo los de la página.
  const { count, error: errorConteo } = await supabase.from("bitacora").select("id", { count: "exact", head: true });
  if (errorConteo) throw new Error(`No se pudo leer la bitácora: ${errorConteo.message}`);
  const pagina = describirPagina(leerPagina((await searchParams).pagina), count ?? 0);
  const { desde, hasta } = rangoDePagina(pagina.pagina);
  const { data, error } = await supabase
    .from("bitacora")
    .select("accion, detalle, ocurrido_en, usuario(nombre), factura(uuid_fiscal, nombre_emisor)")
    .order("ocurrido_en", { ascending: false })
    .order("id", { ascending: false })
    .range(desde, hasta);
  if (error) throw new Error(`No se pudo leer la bitácora: ${error.message}`);

  // D6: nombres de los clientes de las exportaciones y cierres, para mostrar el detalle en palabras (RLS: solo los tuyos).
  const ids = clientesEnDetalles((data ?? []).map((r) => r.detalle as Record<string, unknown> | null));
  const { data: clientes } = ids.length
    ? await supabase.from("clientes").select("id, razon_social").in("id", ids)
    : { data: [] as { id: string; razon_social: string }[] };
  const nombres = new Map((clientes ?? []).map((c) => [c.id as string, c.razon_social as string]));

  return (
    <AppShell active="/bitacora">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">{perfil.despacho}</span>
        <h1 className="m-0 text-[30px] font-bold">Bitácora</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Quién hizo cada acción y cuándo. Los registros no se pueden modificar ni borrar. Lo más reciente va primero.
        </p>
      </header>

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        {/* Solo la tabla se desplaza de lado; la paginación queda fija debajo. */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              <th className="px-5 py-3.5 font-semibold">Cuándo</th>
              <th className="px-3 py-3.5 font-semibold">Quién</th>
              <th className="px-3 py-3.5 font-semibold">Acción</th>
              <th className="px-3 py-3.5 font-semibold">Factura</th>
              <th className="px-5 py-3.5 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r, i) => {
              const usuario = r.usuario as unknown as { nombre: string } | null;
              const factura = r.factura as unknown as { uuid_fiscal: string; nombre_emisor: string | null } | null;
              return (
                <tr key={i} className="border-t border-[#EEF1F4]">
                  <td className="px-5 py-3 whitespace-nowrap">{fecha(r.ocurrido_en)}</td>
                  <td className="px-3 py-3">{usuario?.nombre ?? "—"}</td>
                  <td className="px-3 py-3">{ACCIONES[r.accion] ?? r.accion}</td>
                  <td className="px-3 py-3">
                    {factura ? (
                      <>
                        <span className="block">{factura.nombre_emisor ?? "—"}</span>
                        <span className="font-mono text-[12px] text-text-muted">{factura.uuid_fiscal}</span>
                      </>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text-muted">
                    {describirDetalle(r.accion, r.detalle as Record<string, unknown> | null, nombres) ??
                      (r.detalle ? JSON.stringify(r.detalle) : "—")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {(data ?? []).length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">Aún no hay acciones registradas.</p>
        )}
        <Paginacion ruta="/bitacora" pagina={pagina} nombre="registros" />
      </section>
    </AppShell>
  );
}
