"use client";

import { useState } from "react";
import { guardarClaveCategoria } from "./acciones";

type Opcion = { id: string; nombre: string };

// Al cambiar la opción se guarda sola. Vacío = sin categoría.
// Si la categoría es una sugerencia automática, «Confirmar» la guarda tal cual como asignada a mano.
export function SelectorCategoria({
  clave,
  categoriaId,
  opciones,
  sugerida = false,
  aviso,
}: {
  clave: string;
  categoriaId: string | null;
  opciones: Opcion[];
  sugerida?: boolean;
  aviso?: string;
}) {
  const [valor, setValor] = useState(categoriaId ?? "");
  const [porConfirmar, setPorConfirmar] = useState(sugerida);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(nuevo: string) {
    const anterior = valor;
    const anteriorPorConfirmar = porConfirmar;
    setValor(nuevo);
    setPorConfirmar(false);
    setError("");
    setGuardando(true);
    const resultado = await guardarClaveCategoria(clave, nuevo);
    setGuardando(false);
    if (resultado.error) {
      setValor(anterior);
      setPorConfirmar(anteriorPorConfirmar);
      setError(resultado.error);
    }
  }

  const nombreSugerida = opciones.find((o) => o.id === valor)?.nombre;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Categoría de la clave ${clave}`}
          value={valor}
          disabled={guardando}
          onChange={(e) => guardar(e.target.value)}
          className="h-10 min-w-[240px] rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px]"
        >
          <option value="">Sin categoría</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
        {porConfirmar && valor !== "" && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => guardar(valor)}
            aria-label={`Confirmar «${nombreSugerida ?? "la sugerencia"}» para la clave ${clave}`}
            className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Confirmar"}
          </button>
        )}
      </div>
      {porConfirmar && !error && (
        <span className="text-[13px] text-text-muted">Sugerida automáticamente. Confírmala o cámbiala.</span>
      )}
      {aviso && !error && <span className="max-w-[360px] text-[13px] text-warn-soft-text">{aviso}</span>}
      {error && (
        <span role="alert" className="text-[13px] text-[#B42318]">
          {error}
        </span>
      )}
    </div>
  );
}
