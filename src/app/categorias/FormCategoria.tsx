"use client";

import { useState } from "react";
import { guardarCategoria } from "./acciones";
import type { Categoria } from "@/lib/datos";

const campo = "h-[46px] rounded-lg border border-[#8A96A3] bg-surface px-3.5 text-[15px]";

// Sin categoría = formulario de alta; con categoría = edición de esa fila.
export function FormCategoria({ categoria }: { categoria?: Categoria }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setEnviando(true);
    const resultado = await guardarCategoria(new FormData(form));
    setEnviando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    if (!categoria) form.reset();
  }

  const id = categoria?.id ?? "nueva";

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
      {categoria && <input type="hidden" name="id" value={categoria.id} />}
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <label htmlFor={`nombre-${id}`} className="text-sm font-semibold">Nombre</label>
        <input
          id={`nombre-${id}`}
          name="nombre"
          required
          maxLength={60}
          defaultValue={categoria?.nombre ?? ""}
          placeholder="Nueva categoría"
          className={campo}
        />
      </div>
      <label className="flex h-[46px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="deducible"
          defaultChecked={categoria ? categoria.deducibleDefault : true}
          className="h-4 w-4"
        />
        Deducible por defecto
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="h-[46px] rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {enviando ? "Guardando…" : categoria ? "Guardar" : "Agregar categoría"}
      </button>
      {error && (
        <p role="alert" className="m-0 w-full text-sm text-[#B42318]">
          {error}
        </p>
      )}
    </form>
  );
}
