import { AppShell } from "@/components/AppShell";
import { SubidorXml } from "@/components/SubidorXml";
import { NOMBRE_APP } from "@/lib/config";
import { getArchivosSinCliente, getPerfil } from "@/lib/datos";
import { subirAEntrada } from "@/app/clientes/[clienteId]/acciones";

export const metadata = { title: `Bandeja de entrada · ${NOMBRE_APP}` };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

export default async function EntradaPage() {
  const [perfil, sinCliente] = await Promise.all([getPerfil(), getArchivosSinCliente()]);

  return (
    <AppShell active="/entrada">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">{perfil?.despacho || "Sin despacho"}</span>
        <h1 className="m-0 text-[30px] font-bold">Bandeja de entrada</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Sube facturas XML, PDF o fotos sin elegir cliente. Cada una va al repositorio de su emisor o receptor.
        </p>
      </header>

      <SubidorXml
        enviar={subirAEntrada}
        etiqueta="Seleccionar archivos"
        pista="Puedes elegir varios archivos a la vez."
        aceptar=".xml,.pdf,.jpg,.jpeg,.png,application/xml,text/xml,application/pdf,image/jpeg,image/png"
      />

      <section className="flex flex-col rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="m-0 text-lg font-semibold">Sin cliente ({sinCliente.length})</h2>
        </div>
        {sinCliente.length === 0 ? (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">No hay facturas sin cliente.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {sinCliente.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF1F4] px-5 py-3.5">
                <span className="font-semibold">{a.nombre}</span>
                <span className="text-sm text-text-muted">
                  {a.motivo} · {fecha(a.recibido)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
