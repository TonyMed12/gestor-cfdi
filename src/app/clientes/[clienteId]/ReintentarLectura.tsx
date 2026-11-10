"use client";

import { useState } from "react";
import { reintentarLectura } from "./acciones";

export function ReintentarLectura({ archivoId, nombre }: { archivoId: string; nombre: string }) {
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function reintentar() {
    setMensaje("");
    setEnviando(true);
    try {
      const resultado = await reintentarLectura(archivoId);
      setMensaje(resultado.texto);
    } catch {
      setMensaje("No se pudo reintentar; vuelve a intentarlo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={reintentar}
        disabled={enviando}
        aria-label={`Volver a leer ${nombre}`}
        className="text-sm font-semibold text-accent enabled:hover:underline disabled:opacity-60"
      >
        {enviando ? "Leyendo…" : "Reintentar"}
      </button>
      {mensaje && (
        <span role="status" className="max-w-[260px] text-right text-[13px] text-text-muted">
          {mensaje}
        </span>
      )}
    </div>
  );
}
