"use client";

import { useState } from "react";
import { reconsultarSat } from "../../acciones";

export function BotonSat({ archivoId }: { archivoId: string }) {
  const [mensaje, setMensaje] = useState("");
  const [consultando, setConsultando] = useState(false);

  async function consultar() {
    setMensaje("");
    setConsultando(true);
    const resultado = await reconsultarSat(archivoId);
    setConsultando(false);
    setMensaje(resultado.texto);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={consultar}
        disabled={consultando}
        className="h-9 rounded-lg border border-accent px-3 text-sm font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
      >
        {consultando ? "Consultando…" : "Consultar de nuevo"}
      </button>
      {mensaje && (
        <span role="status" className="text-[13px] text-text-muted">
          {mensaje}
        </span>
      )}
    </div>
  );
}
