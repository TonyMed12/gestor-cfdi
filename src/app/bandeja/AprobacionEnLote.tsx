"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { aprobarFacturasEnLote, type ResultadoLote } from "@/app/revision/[facturaId]/acciones";

// Aprobación en lote de la bandeja (A6). Envuelve la tabla, que se dibuja en el servidor:
// cada fila trae una casilla name="factura" y el encabezado una name="todas".
// Sin permiso para aprobar (activo = false) muestra la tabla tal cual.
export function AprobacionEnLote({ children, activo }: { children: ReactNode; activo: boolean }) {
  if (!activo) return <>{children}</>;
  return <Formulario>{children}</Formulario>;
}

function Formulario({ children }: { children: ReactNode }) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [seleccionadas, setSeleccionadas] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);

  const casillas = () =>
    [...(formulario.current?.querySelectorAll<HTMLInputElement>('input[name="factura"]') ?? [])];

  function alCambiar(e: React.ChangeEvent<HTMLFormElement>) {
    const objetivo = e.target as unknown as HTMLInputElement;
    if (objetivo.name === "todas") casillas().forEach((c) => (c.checked = objetivo.checked));
    const marcadas = casillas().filter((c) => c.checked).length;
    const todas = formulario.current?.querySelector<HTMLInputElement>('input[name="todas"]');
    if (todas) todas.checked = marcadas > 0 && marcadas === casillas().length;
    setSeleccionadas(marcadas);
    setConfirmando(false);
  }

  function limpiar() {
    casillas().forEach((c) => (c.checked = false));
    const todas = formulario.current?.querySelector<HTMLInputElement>('input[name="todas"]');
    if (todas) todas.checked = false;
    setSeleccionadas(0);
  }

  async function aprobar() {
    const ids = casillas().filter((c) => c.checked).map((c) => c.value);
    setEnviando(true);
    setResultado(null);
    const r = await aprobarFacturasEnLote(ids);
    setEnviando(false);
    setConfirmando(false);
    setResultado(r);
    if (!r.error) limpiar();
    router.refresh();
  }

  return (
    <form ref={formulario} onChange={alCambiar} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
      <section
        aria-label="Aprobar varias facturas"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">
            {seleccionadas === 0
              ? "Marca varias facturas para aprobarlas juntas"
              : seleccionadas === 1
                ? "1 factura seleccionada"
                : `${seleccionadas} facturas seleccionadas`}
          </span>
          {!confirmando && (
            <button
              type="button"
              disabled={seleccionadas === 0 || enviando}
              onClick={() => setConfirmando(true)}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              Aprobar seleccionadas
            </button>
          )}
          {seleccionadas > 0 && !confirmando && !enviando && (
            <button type="button" onClick={limpiar} className="text-sm font-semibold text-accent-soft-text">
              Quitar selección
            </button>
          )}
        </div>

        {confirmando && (
          <div className="flex flex-col gap-3 rounded-lg border border-[#E7C873] bg-[#FFF8E6] p-4">
            <p className="m-0 text-sm">
              ¿Aprobar {seleccionadas === 1 ? "1 factura" : `${seleccionadas} facturas`} con la clasificación propuesta?
              Las que tengan conceptos sin categoría no se aprobarán. Una factura aprobada ya no se puede corregir.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={aprobar}
                disabled={enviando}
                className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {enviando ? "Aprobando…" : "Sí, aprobar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={enviando}
                className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div aria-live="polite" className="flex flex-col gap-2">
          {resultado?.error && (
            <p role="alert" className="m-0 text-sm text-[#B42318]">
              {resultado.error}
            </p>
          )}
          {resultado && !resultado.error && (
            <>
              <p className="m-0 text-sm font-semibold text-accent-soft-text">
                {resultado.aprobadas.length === 1
                  ? "Se aprobó 1 factura."
                  : `Se aprobaron ${resultado.aprobadas.length} facturas.`}{" "}
                {resultado.aprobadas.length > 0 && "Cada aprobación quedó en la bitácora."}
              </p>
              {resultado.noAprobadas.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="m-0 text-sm font-semibold text-warn-soft-text">
                    {resultado.noAprobadas.length === 1
                      ? "1 factura no se aprobó:"
                      : `${resultado.noAprobadas.length} facturas no se aprobaron:`}
                  </p>
                  <ul className="m-0 flex flex-col gap-1.5 p-0">
                    {resultado.noAprobadas.map((n) => (
                      <li
                        key={n.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FFF6E6] px-3.5 py-2 text-sm"
                      >
                        <Link href={`/revision/${n.id}`} className="text-text">
                          {n.descripcion}
                        </Link>
                        <span className="font-semibold text-warn-soft-text">{n.motivo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      {children}
    </form>
  );
}
