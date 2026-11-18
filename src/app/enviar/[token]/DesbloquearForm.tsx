"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { desbloquearEnlace } from "./acciones";

export function DesbloquearForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const contrasena = String(new FormData(e.currentTarget).get("contrasena") ?? "");
    setError("");
    setEnviando(true);
    const resultado = await desbloquearEnlace(token, contrasena);
    setEnviando(false);
    if (resultado.error) return setError(resultado.error);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Contraseña
        <div className="flex gap-2">
          <input
            name="contrasena"
            type={mostrar ? "text" : "password"}
            required
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-12 min-w-0 flex-1 rounded-lg border border-[#8A96A3] bg-surface px-3.5 font-mono text-[17px] tracking-widest uppercase"
          />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            className="h-12 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
          >
            {mostrar ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="h-12 rounded-lg bg-accent px-4 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {enviando ? "Verificando…" : "Continuar"}
      </button>
      {error && (
        <p role="alert" className="m-0 rounded-lg border border-[#F3C2BD] bg-[#FDF0EE] px-3.5 py-2.5 text-sm text-[#B42318]">
          {error}
        </p>
      )}
    </form>
  );
}
