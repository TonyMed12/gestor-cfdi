import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buscarAcceso, sesionValida, venció } from "@/lib/enlace";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DesbloquearForm } from "./DesbloquearForm";
import { EnviarForm } from "./EnviarForm";

export const metadata: Metadata = {
  title: "Enviar facturas",
  robots: { index: false, follow: false },
};

// Página pública (sin cuenta). Sin token válido no se muestra nada; sin contraseña, solo el formulario de acceso.
export default async function EnviarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();

  const acceso = await buscarAcceso(token);
  if (!acceso) notFound();

  const { data: cliente } = await supabaseAdmin()
    .from("clientes").select("razon_social").eq("id", acceso.cliente_id).maybeSingle();
  if (!cliente) notFound();

  const cuerpo = venció(acceso) ? (
    <p role="alert" className="m-0 rounded-xl border border-border bg-surface p-6 text-[15px]">
      Este enlace venció. Pide uno nuevo a tu contador.
    </p>
  ) : (await sesionValida(token)) ? (
    <EnviarForm token={token} />
  ) : (
    <DesbloquearForm token={token} />
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-[26px] font-bold">Envía tus facturas</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Para {cliente.razon_social}. {venció(acceso) ? "" : "Selecciona tus archivos XML y envíalos."}
        </p>
      </header>
      {cuerpo}
    </main>
  );
}
