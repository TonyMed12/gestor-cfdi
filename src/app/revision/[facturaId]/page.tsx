import { notFound } from "next/navigation";
import { NOMBRE_APP } from "@/lib/config";
import { getCategorias, getFacturaPorId, getHistorialClasificacion, getPerfil } from "@/lib/datos";
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
  const [categorias, historial, perfil] = await Promise.all([
    getCategorias(factura.clienteId),
    getHistorialClasificacion(factura.conceptos.flatMap((c) => (c.id ? [c.id] : []))),
    getPerfil(),
  ]);

  return (
    <RevisionClient
      factura={factura}
      categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre, deducible: c.deducibleDefault }))}
      historial={historial}
      puedeDecidir={perfil?.rol === "administrador" || perfil?.rol === "contador"}
    />
  );
}
