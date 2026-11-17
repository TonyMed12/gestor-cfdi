"use client";

import { useState } from "react";
import { guardarClaveCategoria } from "./acciones";

type Opcion = { id: string; nombre: string };

// Al cambiar la opción se guarda sola. Vacío = sin categoría.
export function SelectorCategoria({
  clave,
  categoriaId,
  opciones,
  sugerida = false,
}: {
  clave: string;
  categoriaId: string | null;
  opciones: Opcion[];
  sugerida?: boolean;
}) {
  const [valor, setValor] = useState(categoriaId ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function cambiar(nuevo: string) {
    const anterior = valor;
    setValor(nuevo);
    setError("");
    setGuardando(true);
    const resultado = await guardarClaveCategoria(clave, nuevo);
    setGuardando(false);
    if (resultado.error) {
      setValor(anterior);
      setError(resultado.error);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={`Categoría de la clave ${clave}`}
        value={valor}
        disabled={guardando}
        onChange={(e) => cambiar(e.target.value)}
        className="h-10 min-w-[240px] rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px]"
      >
        <option value="">Sin categoría</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
      {sugerida && !error && (
        <span className="text-[13px] text-text-muted">Sugerida por división del SAT. Confírmala o cámbiala.</span>
      )}
      {error && (
        <span role="alert" className="text-[13px] text-[#B42318]">
          {error}
        </span>
      )}
    </div>
  );
}
