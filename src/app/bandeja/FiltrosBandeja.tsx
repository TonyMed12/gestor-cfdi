import { PanelFiltros } from "@/components/PanelFiltros";
import type { FiltrosBandeja as Filtros, Orden } from "@/lib/filtros";
import { nombreMes } from "@/lib/formato";

const ETIQUETA_ORDEN: Record<Orden, string> = {
  prioridad: "Prioridad (lo urgente primero)",
  fecha_desc: "Fecha: más recientes primero",
  fecha_asc: "Fecha: más antiguas primero",
  monto_desc: "Monto: mayor a menor",
  monto_asc: "Monto: menor a mayor",
};

const ESTADO_SAT: Record<string, string> = {
  vigente: "Vigente",
  cancelada: "Cancelada",
  no_encontrada: "No encontrada",
  sin_consultar: "Sin consultar",
};

const campo = "h-10 rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px] font-normal";
const etiqueta = "flex flex-col gap-1 text-sm font-semibold";
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// Lo aplicado, en palabras, para verlo con el panel cerrado. El tipo tiene sus propios botones.
function describirFiltrosBandeja(filtros: Filtros, clientes: { id: string; razonSocial: string }[]): string[] {
  const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  return [
    filtros.cliente && (clientes.find((c) => c.id === filtros.cliente)?.razonSocial ?? "Cliente"),
    filtros.periodo && mayuscula(nombreMes(filtros.periodo)),
    filtros.emisor && `Emisor: ${filtros.emisor}`,
    filtros.receptor && `Receptor: ${filtros.receptor}`,
    filtros.estadoSat && `SAT: ${ESTADO_SAT[filtros.estadoSat]}`,
    filtros.montoMin !== undefined && filtros.montoMax !== undefined
      ? `${pesos(filtros.montoMin)} a ${pesos(filtros.montoMax)}`
      : filtros.montoMin !== undefined
        ? `Desde ${pesos(filtros.montoMin)}`
        : filtros.montoMax !== undefined && `Hasta ${pesos(filtros.montoMax)}`,
    filtros.orden !== "prioridad" && `Orden: ${ETIQUETA_ORDEN[filtros.orden].toLowerCase()}`,
  ].filter((a): a is string => Boolean(a));
}

// Filtros generales de la bandeja (B2): botón «Filtros» que despliega, debajo, un formulario GET; así los filtros
// quedan en la URL y se combinan con el tipo de comprobante y la paginación. Funciona sin JavaScript.
export function FiltrosBandeja({
  filtros,
  clientes,
  periodos,
  avisos,
}: {
  filtros: Filtros;
  clientes: { id: string; razonSocial: string }[];
  periodos: string[]; // AAAA-MM, del más reciente al más antiguo
  avisos: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
    <PanelFiltros
      activos={describirFiltrosBandeja(filtros, clientes)}
      quitarHref={filtros.tipo ? `/bandeja?tipo=${filtros.tipo}` : "/bandeja"}
    >
    <form
      role="search"
      aria-label="Filtrar la bandeja"
      action="/bandeja"
      method="get"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-5 py-4"
    >
      {/* El tipo se elige con los botones de arriba; aquí solo se conserva. */}
      {filtros.tipo && <input type="hidden" name="tipo" value={filtros.tipo} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <label className={etiqueta}>
          Cliente
          <select name="cliente" defaultValue={filtros.cliente ?? ""} className={campo}>
            <option value="">Todos los clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.razonSocial}</option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Periodo
          <select name="periodo" defaultValue={filtros.periodo ?? ""} className={campo}>
            <option value="">Todos los periodos</option>
            {periodos.map((p) => (
              <option key={p} value={p}>{mayuscula(nombreMes(p))}</option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          RFC o nombre del emisor
          <input
            name="emisor"
            defaultValue={filtros.emisor ?? ""}
            placeholder="Por ejemplo HUGO ROJAS o ROTH84"
            title="El RFC o el nombre del proveedor, completo o una parte; sin importar mayúsculas"
            autoComplete="off"
            spellCheck={false}
            className={`${campo} uppercase placeholder:normal-case`}
          />
        </label>
        <label className={etiqueta}>
          RFC del receptor
          <input
            name="receptor"
            defaultValue={filtros.receptor ?? ""}
            placeholder="Completo o una parte"
            autoComplete="off"
            spellCheck={false}
            className={`${campo} font-mono uppercase placeholder:font-sans placeholder:normal-case`}
          />
        </label>
        <label className={etiqueta}>
          Estado ante el SAT
          <select name="sat" defaultValue={filtros.estadoSat ?? ""} className={campo}>
            <option value="">Todos</option>
            {Object.entries(ESTADO_SAT).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </label>
        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold">Monto total (MXN)</legend>
          <div className="flex items-center gap-2">
            <input
              name="min"
              inputMode="decimal"
              defaultValue={filtros.montoMin ?? ""}
              placeholder="Desde"
              aria-label="Monto mínimo"
              className={`${campo} w-full min-w-0`}
            />
            <span className="text-text-muted">–</span>
            <input
              name="max"
              inputMode="decimal"
              defaultValue={filtros.montoMax ?? ""}
              placeholder="Hasta"
              aria-label="Monto máximo"
              className={`${campo} w-full min-w-0`}
            />
          </div>
        </fieldset>
        <label className={etiqueta}>
          Ordenar por
          <select name="orden" defaultValue={filtros.orden} className={campo}>
            {Object.entries(ETIQUETA_ORDEN).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
          Aplicar filtros
        </button>
      </div>
    </form>
    </PanelFiltros>
      {/* Fuera del panel: se ven aunque esté cerrado. */}
      {avisos.length > 0 && (
        <ul role="alert" className="m-0 flex flex-col gap-1 p-0 text-[13px] text-[#B42318]">
          {avisos.map((a) => (
            <li key={a} className="list-none">{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
