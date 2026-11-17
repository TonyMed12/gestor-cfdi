"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { desbloquearEnlace } from "./acciones";

export function DesbloquearForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const contrasena = String(new FormData(form).get("contrasena") ?? "");
    setError("");
    setEnviando(true);
    const resultado = await desbloquearEnlace(token, contrasena);
    setEnviando(false);
    if (resultado.error) return setError(resultado.error);
    router.refresh(); // la página vuelve a cargar ya con la sesión: aparece el formulario de envío
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Contraseña
        <input
          name="contrasena"
          required
          maxLength={20}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="10 caracteres"
          className="h-12 rounded-lg border border-[#8A96A3] bg-surface px-3.5 font-mono text-[17px] tracking-widest uppercase"
        />
      </label>
      <p className="m-0 text-sm text-text-muted">
        Tu contador te dio esta contraseña. Si no la tienes, pídesela.
      </p>
      <button
        type="submit"
        disabled={enviando}
        className="h-12 rounded-lg bg-accent px-4 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {enviando ? "Revisando…" : "Continuar"}
      </button>
      {error && <p role="alert" className="m-0 text-sm text-[#B42318]">{error}</p>}
    </form>
  );
}
