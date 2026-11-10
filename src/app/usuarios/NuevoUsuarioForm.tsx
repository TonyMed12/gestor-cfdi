"use client";

import { useState } from "react";
import { crearUsuario } from "./acciones";

const campo = "h-[46px] rounded-lg border border-[#C9D1DA] bg-surface px-3.5 text-[15px]";

export function NuevoUsuarioForm() {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setEnviando(true);
    const resultado = await crearUsuario(new FormData(form));
    setEnviando(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    form.reset();
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex min-w-[200px] flex-1 flex-col gap-2">
        <label htmlFor="nombre" className="text-sm font-semibold">Nombre</label>
        <input id="nombre" name="nombre" required placeholder="Nombre completo" className={campo} />
      </div>
      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <label htmlFor="correo" className="text-sm font-semibold">Correo</label>
        <input id="correo" name="correo" type="email" required placeholder="correo@despacho.mx" className={campo} />
      </div>
      <div className="flex min-w-[160px] flex-col gap-2">
        <label htmlFor="rol" className="text-sm font-semibold">Rol</label>
        <select id="rol" name="rol" required defaultValue="" className={campo}>
          <option value="" disabled>Elige un rol</option>
          <option value="contador">Contador</option>
          <option value="auxiliar">Auxiliar</option>
          <option value="administrador">Administrador</option>
        </select>
      </div>
      <div className="flex min-w-[200px] flex-col gap-2">
        <label htmlFor="contrasena" className="text-sm font-semibold">Contraseña temporal</label>
        <input
          id="contrasena"
          name="contrasena"
          required
          minLength={8}
          autoComplete="off"
          placeholder="Mínimo 8 caracteres"
          className={campo}
        />
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="h-[46px] rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {enviando ? "Creando…" : "Crear usuario"}
      </button>
      {error && (
        <p role="alert" className="m-0 basis-full text-sm font-semibold text-warn-soft-text">
          {error}
        </p>
      )}
    </form>
  );
}
