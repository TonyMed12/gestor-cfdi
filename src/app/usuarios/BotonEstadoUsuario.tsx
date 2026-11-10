"use client";

import { useState } from "react";
import { cambiarEstadoUsuario } from "./acciones";

export function BotonEstadoUsuario({ id, activo }: { id: string; activo: boolean }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cambiar() {
    if (activo && !confirm("¿Desactivar a este usuario? Ya no podrá iniciar sesión.")) return;
    setError("");
    setEnviando(true);
    const resultado = await cambiarEstadoUsuario(id, !activo);
    setEnviando(false);
    if (resultado.error) setError(resultado.error);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={cambiar}
        disabled={enviando}
        className="text-sm font-semibold text-accent hover:underline disabled:opacity-60"
      >
        {activo ? "Desactivar" : "Reactivar"}
      </button>
      {error && (
        <span role="alert" className="text-[13px] text-warn-soft-text">
          {error}
        </span>
      )}
    </div>
  );
}
