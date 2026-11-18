import { AppShell } from "@/components/AppShell";
import { NOMBRE_APP } from "@/lib/config";
import { getPerfil } from "@/lib/datos";
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

export default async function BitacoraPage() {
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
  const { data, error } = await supabase
    .from("bitacora")
    .select("accion, detalle, ocurrido_en, usuario(nombre), factura(uuid_fiscal, nombre_emisor)")
    .order("ocurrido_en", { ascending: false })
    .limit(300);
  if (error) throw new Error(`No se pudo leer la bitácora: ${error.message}`);

  return (
    <AppShell active="/bitacora">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">{perfil.despacho}</span>
        <h1 className="m-0 text-[30px] font-bold">Bitácora</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Quién hizo cada acción y cuándo. Los registros no se pueden modificar ni borrar. Se muestran los últimos 300.
        </p>
      </header>

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
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
                    {r.detalle ? JSON.stringify(r.detalle) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(data ?? []).length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">Aún no hay acciones registradas.</p>
        )}
      </section>
    </AppShell>
  );
}
