"use client";

import { useState } from "react";
import { urlArchivo } from "./acciones";

export function VerArchivo({ ruta }: { ruta: string }) {
  const [error, setError] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  async function ver() {
    // La ventana se abre al instante (dentro del clic) para que el navegador no la bloquee.
    const ventana = window.open("about:blank", "_blank");
    if (ventana) ventana.opener = null;
    setError("");
    setAbriendo(true);
    const resultado = await urlArchivo(ruta);
    setAbriendo(false);
    if (!resultado.url) {
      ventana?.close();
      setError(resultado.error ?? "No se pudo abrir el archivo.");
      return;
    }
    if (ventana) ventana.location.href = resultado.url;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={ver}
        disabled={abriendo}
        className="text-sm font-semibold text-accent hover:underline disabled:opacity-60"
      >
        Ver
      </button>
      {error && (
        <span role="alert" className="text-[13px] text-warn-soft-text">
          {error}
        </span>
      )}
    </div>
  );
}
