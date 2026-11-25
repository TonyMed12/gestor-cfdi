import { PanelFiltros } from "@/components/PanelFiltros";
import type { FiltrosArchivos as Filtros } from "@/lib/datos";

const ESTADOS: Record<string, string> = {
  recibido: "Recibido",
  leyendo: "Leyendo",
  por_revisar: "Por revisar",
  clasificado: "Clasificado",
  error: "Con error",
};
const TIPOS: Record<string, string> = { xml: "XML", pdf: "PDF", imagen: "Imagen", zip: "ZIP" };

const campo = "h-10 rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px] font-normal";
const etiqueta = "flex min-w-[170px] flex-1 flex-col gap-1 text-sm font-semibold";

// Filtros de los archivos del cliente (B2): estado y tipo de archivo, y orden por fecha de recepción.
// En un panel plegable con botón «Filtros»; formulario GET, así quedan en la URL y se combinan con la paginación.
export function FiltrosArchivos({ clienteId, filtros }: { clienteId: string; filtros: Filtros }) {
  const activos = [
    filtros.estado && `Estado: ${ESTADOS[filtros.estado]}`,
    filtros.tipo && `Tipo: ${TIPOS[filtros.tipo]}`,
    filtros.antiguos && "Más antiguos primero",
  ].filter((a): a is string => Boolean(a));

  return (
    <PanelFiltros activos={activos} quitarHref={`/clientes/${clienteId}#archivos`}>
      <form
        aria-label="Filtrar archivos"
        action={`/clientes/${clienteId}#archivos`}
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface px-5 py-4"
      >
        <label className={etiqueta}>
          Estado
          <select name="estado" defaultValue={filtros.estado ?? ""} className={campo}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Tipo de archivo
          <select name="tipo" defaultValue={filtros.tipo ?? ""} className={campo}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Ordenar por
          <select name="orden" defaultValue={filtros.antiguos ? "antiguos" : ""} className={campo}>
            <option value="">Recibidos más recientes primero</option>
            <option value="antiguos">Recibidos más antiguos primero</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
          Aplicar filtros
        </button>
      </form>
    </PanelFiltros>
  );
}
