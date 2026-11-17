"use client";

import { useState } from "react";
import { eliminarReglaEmisor, guardarReglaEmisor } from "./acciones";

type Opcion = { id: string; nombre: string };

const campo = "h-[46px] rounded-lg border border-[#8A96A3] bg-surface px-3.5 text-[15px]";

export function FormRegla({ opciones }: { opciones: Opcion[] }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    setError("");
    setEnviando(true);
    const resultado = await guardarReglaEmisor(String(datos.get("rfc")), String(datos.get("categoria")));
    setEnviando(false);
    if (resultado.error) return setError(resultado.error);
    form.reset();
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-[200px] flex-col gap-2">
        <label htmlFor="regla-rfc" className="text-sm font-semibold">RFC del emisor</label>
        <input
          id="regla-rfc"
          name="rfc"
          required
          maxLength={13}
          placeholder="AAA010101AAA"
          className={`${campo} font-mono uppercase`}
        />
      </div>
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <label htmlFor="regla-categoria" className="text-sm font-semibold">Categoría</label>
        <select id="regla-categoria" name="categoria" required defaultValue="" className={campo}>
          <option value="" disabled>Elige una categoría</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="h-[46px] rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {enviando ? "Guardando…" : "Agregar regla"}
      </button>
      {error && (
        <p role="alert" className="m-0 w-full text-sm text-[#B42318]">{error}</p>
      )}
    </form>
  );
}

export function BotonBorrarRegla({ rfc }: { rfc: string }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function borrar() {
    if (!window.confirm(`¿Borrar la regla del RFC ${rfc}? Las facturas volverán a su clasificación por clave.`)) return;
    setError("");
    setEnviando(true);
    const resultado = await eliminarReglaEmisor(rfc);
    setEnviando(false);
    if (resultado.error) setError(resultado.error);
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={borrar}
        disabled={enviando}
        className="text-sm font-semibold text-[#B42318] disabled:opacity-60"
      >
        Borrar
      </button>
      {error && <span role="alert" className="text-[13px] text-[#B42318]">{error}</span>}
    </span>
  );
}
