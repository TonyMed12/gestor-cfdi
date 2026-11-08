import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { NOMBRE_APP } from "@/lib/config";
import { getClientes } from "@/lib/datos";
import { NuevoClienteForm } from "./NuevoClienteForm";

export const metadata = { title: `Clientes · ${NOMBRE_APP}` };

export default async function ClientesPage() {
  const clientes = await getClientes();

  return (
    <AppShell active="/clientes">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[30px] font-bold">Clientes del despacho</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Cada cliente tiene su propio repositorio aislado (RF-01).
        </p>
      </header>
      <NuevoClienteForm />
      <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {clientes.map((c) => (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 no-underline hover:border-accent"
          >
            <span className="font-semibold text-text">{c.razonSocial}</span>
            <span className="font-mono text-sm text-text-muted">{c.rfc}</span>
            <span className="text-sm text-text-muted">
              {c.porRevisar} por revisar · {c.sinLeer} sin leer
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
