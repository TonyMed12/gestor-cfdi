import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { NOMBRE_APP } from "@/lib/config";
import { getClientes, getPerfil } from "@/lib/datos";
import { NuevoClienteForm } from "./NuevoClienteForm";

export const metadata = { title: `Clientes · ${NOMBRE_APP}` };

export default async function ClientesPage() {
  const [clientes, perfil] = await Promise.all([getClientes(), getPerfil()]);
  // G7: solo el administrador y el contador dan de alta clientes (RLS, script 04).
  const puedeCrear = perfil?.rol === "administrador" || perfil?.rol === "contador";

  return (
    <AppShell active="/clientes">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[30px] font-bold">Clientes del despacho</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Cada cliente tiene su propio repositorio aislado.
        </p>
      </header>
      {puedeCrear && <NuevoClienteForm />}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {clientes.map((c) => (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 no-underline hover:border-accent focus-visible:border-accent"
          >
            <span className="flex flex-wrap items-center gap-2 font-semibold text-text">
              {c.razonSocial}
              {/* H2: un cliente desactivado ya no recibe facturas nuevas. */}
              {c.activo === false && (
                <span className="rounded-full bg-[#EEF1F4] px-2 py-0.5 text-[12px] font-semibold text-text-muted">Inactivo</span>
              )}
            </span>
            <span className="font-mono text-sm text-text-muted">{c.rfc}</span>
            <span className="text-sm text-text-muted">
              {c.porRevisar} por revisar · {c.sinLeer} sin leer · {c.conError} con error
            </span>
          </Link>
        ))}
        {clientes.length === 0 && (
          <p className="m-0 text-sm text-text-muted">Aún no hay clientes.</p>
        )}
      </section>
    </AppShell>
  );
}
