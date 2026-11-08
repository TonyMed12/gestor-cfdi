import { notFound } from "next/navigation";
import { NOMBRE_APP } from "@/lib/config";
import { getFacturaPorId } from "@/lib/mock-data";
import { RevisionClient } from "./RevisionClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ facturaId: string }>;
}) {
  const { facturaId } = await params;
  const factura = getFacturaPorId(facturaId);
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
  const factura = getFacturaPorId(facturaId);
  if (!factura) notFound();

  return <RevisionClient factura={factura} />;
}
