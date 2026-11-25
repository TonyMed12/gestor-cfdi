"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClaveEnUso } from "@/lib/datos";
import { guardarClavesCategoria } from "./acciones";
import { SelectorCategoria } from "./SelectorCategoria";

type Opcion = { id: string; nombre: string };

// Tabla de Claves del SAT. Quien puede editar elige cada clave con su selector o marca varias
// y les asigna una categoría en un solo paso (A4).
export function TablaClaves({
  claves,
  categorias,
  puedeEditar,
}: {
  claves: ClaveEnUso[];
  categorias: Opcion[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [categoriaLote, setCategoriaLote] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok?: string; error?: string }>({});

  const todas = claves.length > 0 && seleccion.size === claves.length;
  const alternar = (clave: string) =>
    setSeleccion((s) => {
      const nueva = new Set(s);
      if (nueva.has(clave)) nueva.delete(clave);
      else nueva.add(clave);
      return nueva;
    });

  async function asignar() {
    setResultado({});
    setGuardando(true);
    const r = await guardarClavesCategoria([...seleccion], categoriaLote);
    setGuardando(false);
    if (r.error) return setResultado({ error: r.error });
    const nombre = categorias.find((k) => k.id === categoriaLote)?.nombre ?? "";
    setResultado({
      ok: `Se asignó «${nombre}» a ${r.asignadas === 1 ? "1 clave" : `${r.asignadas} claves`}. Las facturas pendientes con esas claves ya se actualizaron.`,
    });
    setSeleccion(new Set());
    setCategoriaLote("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar && claves.length > 0 && (
        <section
          aria-label="Asignar categoría a varias claves"
          className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-5 py-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">
              {seleccion.size === 0
                ? "Marca varias claves para asignarles la misma categoría"
                : seleccion.size === 1
                  ? "1 clave seleccionada"
                  : `${seleccion.size} claves seleccionadas`}
            </span>
            <select
              aria-label="Categoría para las claves seleccionadas"
              value={categoriaLote}
              disabled={guardando || seleccion.size === 0}
              onChange={(e) => setCategoriaLote(e.target.value)}
              className="h-10 min-w-[240px] rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px] disabled:opacity-60"
            >
              <option value="">Elige una categoría</option>
              {categorias.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={asignar}
              disabled={guardando || seleccion.size === 0 || categoriaLote === ""}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Asignar a las seleccionadas"}
            </button>
            {seleccion.size > 0 && !guardando && (
              <button type="button" onClick={() => setSeleccion(new Set())} className="text-sm font-semibold text-accent-soft-text">
                Quitar selección
              </button>
            )}
          </div>
          <div aria-live="polite">
            {resultado.ok && <p className="m-0 text-sm text-accent-soft-text">{resultado.ok}</p>}
            {resultado.error && (
              <p role="alert" className="m-0 text-sm text-[#B42318]">
                {resultado.error}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[920px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              {puedeEditar && (
                <th className="w-12 py-3.5 pl-5">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todas las claves"
                    checked={todas}
                    disabled={guardando || claves.length === 0}
                    onChange={() => setSeleccion(todas ? new Set() : new Set(claves.map((c) => c.clave)))}
                    className="h-4 w-4"
                  />
                </th>
              )}
              <th className={`${puedeEditar ? "px-3" : "px-5"} py-3.5 font-semibold`}>Clave</th>
              <th className="px-3 py-3.5 font-semibold">Descripción del SAT</th>
              <th className="px-3 py-3.5 font-semibold">Aparece en</th>
              <th className="px-3 py-3.5 text-right font-semibold">
                <abbr title="Facturas por revisar o por confirmar: se actualizan si cambias la categoría" className="no-underline">
                  Pendientes
                </abbr>
              </th>
              <th className="px-3 py-3.5 text-right font-semibold">
                <abbr title="Facturas aprobadas: conservan su categoría aunque cambies la clave" className="no-underline">
                  Aprobadas
                </abbr>
              </th>
              <th className="px-3 py-3.5 font-semibold">Categoría</th>
            </tr>
          </thead>
          <tbody>
            {claves.map((c) => (
              <tr
                key={c.clave}
                className={`border-t border-[#EEF1F4] ${seleccion.has(c.clave) ? "bg-[#F3FAF8]" : ""}`}
              >
                {puedeEditar && (
                  <td className="py-3.5 pl-5">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar la clave ${c.clave}`}
                      checked={seleccion.has(c.clave)}
                      disabled={guardando}
                      onChange={() => alternar(c.clave)}
                      className="h-4 w-4"
                    />
                  </td>
                )}
                <td className={`${puedeEditar ? "px-3" : "px-5"} py-3.5 font-mono text-sm`}>{c.clave}</td>
                <td className="px-3 py-3.5">{c.descripcion}</td>
                <td className="px-3 py-3.5 text-sm text-text-muted">
                  {c.recibidas > 0 && <div>{c.recibidas} {c.recibidas === 1 ? "recibida" : "recibidas"}</div>}
                  {c.emitidas > 0 && <div>{c.emitidas} {c.emitidas === 1 ? "emitida" : "emitidas"}</div>}
                </td>
                <td className="px-3 py-3.5 text-right font-semibold">{c.pendientes}</td>
                <td className="px-3 py-3.5 text-right text-text-muted">{c.aprobadas}</td>
                <td className="px-3 py-3.5">
                  {puedeEditar ? (
                    // La key cambia cuando cambia la categoría guardada: así el selector toma el valor nuevo
                    // después de asignar en lote.
                    <SelectorCategoria
                      key={`${c.clave}-${c.categoriaId ?? ""}-${c.porDefecto}`}
                      clave={c.clave}
                      categoriaId={c.categoriaId}
                      sugerida={c.porDefecto}
                      aviso={c.aviso}
                      opciones={categorias}
                    />
                  ) : (
                    <>
                      {categorias.find((k) => k.id === c.categoriaId)?.nombre ?? "Sin categoría"}
                      {c.aviso && <div className="text-[13px] text-warn-soft-text">{c.aviso}</div>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {claves.length === 0 && (
          <p className="m-0 px-5 py-8 text-center text-sm text-text-muted">
            Aún no hay facturas con conceptos. Cuando subas XML, sus claves aparecerán aquí.
          </p>
        )}
      </section>
    </div>
  );
}
