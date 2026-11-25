import { AppShell } from "@/components/AppShell";
import { Paginacion } from "@/components/Paginacion";
import { NOMBRE_APP } from "@/lib/config";
import { getCategorias, getClavesEnUso, getPerfil } from "@/lib/datos";
import { leerPagina } from "@/lib/paginacion";
import { TablaClaves } from "./TablaClaves";

export const metadata = { title: `Claves del SAT · ${NOMBRE_APP}` };

export default async function ClavesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina: paginaPedida } = await searchParams;
  const perfil = await getPerfil();
  // B4: de 50 en 50, en orden de clave.
  const [{ claves, pagina }, categorias] = await Promise.all([getClavesEnUso(leerPagina(paginaPedida)), getCategorias()]);
  const puedeEditar = perfil?.rol === "administrador" || perfil?.rol === "contador";
  const sinCategoria = claves.filter((c) => c.categoriaId === null).length;
  const porConfirmar = claves.filter((c) => c.porDefecto).length;
  const conAviso = claves.filter((c) => c.aviso).length;
  const variasPaginas = pagina.paginas > 1;

  return (
    <AppShell active="/claves">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">{perfil?.despacho || "Sin despacho"}</span>
        <h1 className="m-0 text-[30px] font-bold">Claves del SAT en tus facturas</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Cada concepto de una factura trae una clave del SAT. Elige a qué categoría pertenece cada
          una. Las facturas nuevas con esa clave se clasifican solas y las pendientes de aprobar se
          actualizan al momento. Las aprobadas conservan la categoría con la que se aprobaron.
        </p>
        <p className="m-0 text-sm text-text-muted">
          {pagina.total} claves en uso{variasPaginas ? ` · en esta página: ` : " · "}
          {sinCategoria} sin categoría · {porConfirmar} sugeridas sin confirmar
          {conAviso > 0 && ` · ${conAviso} con aviso`}
        </p>
        <p className="m-0 text-sm text-text-muted">
          En facturas emitidas (ingresos) solo se usan categorías de ingreso, y en recibidas (gastos),
          solo de gasto.
        </p>
      </header>

      <TablaClaves
        claves={claves}
        categorias={categorias.map((k) => ({ id: k.id, nombre: k.nombre }))}
        puedeEditar={puedeEditar}
      />
      <Paginacion ruta="/claves" pagina={pagina} nombre="claves" />
    </AppShell>
  );
}
