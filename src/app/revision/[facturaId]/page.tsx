import { notFound } from "next/navigation";
import { NOMBRE_APP } from "@/lib/config";
import { getFacturaPorId } from "@/lib/datos";
import { RevisionClient } from "./RevisionClient";

// Un id que no es UUID daría error de Postgres; se trata como factura inexistente.
const esUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ facturaId: string }>;
}) {
  const { facturaId } = await params;
  const factura = esUuid(facturaId) ? await getFacturaPorId(facturaId) : undefined;
  return {
    title: factura
      ? `${factura.emisorNombre} · Revisión · ${NOMBRE_APP}`
      : "Revisión",
  };
}

export default async function RevisionPage({
  params,
}: {
  params: Promise<{ facturaId: string }>;
}) {
  const { facturaId } = await params;
  const factura = esUuid(facturaId) ? await getFacturaPorId(facturaId) : undefined;
  if (!factura) notFound();

  return <RevisionClient factura={factura} />;
}
