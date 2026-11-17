"use client";

import { useState } from "react";
import { subirXmlPorEnlace, type ResultadoEnvio } from "@/app/clientes/[clienteId]/acciones";

export function EnviarForm({ token }: { token: string }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultados, setResultados] = useState<ResultadoEnvio[]>([]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setResultados([]);
    setEnviando(true);
    const respuesta = await subirXmlPorEnlace(token, new FormData(form));
    setEnviando(false);
    if (respuesta.error) return setError(respuesta.error);
    setResultados(respuesta.resultados);
    if (respuesta.resultados.every((r) => r.bien)) form.reset();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Archivos XML (hasta 20)
        <input
          type="file"
          name="archivos"
          accept=".xml,application/xml,text/xml"
          multiple
          required
          className="text-[15px] font-normal"
        />
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="h-12 rounded-lg bg-accent px-4 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar facturas"}
      </button>

      {error && <p role="alert" className="m-0 text-sm text-[#B42318]">{error}</p>}

      {resultados.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {resultados.map((r, i) => (
            <li key={i} className="text-sm">
              <span className="font-semibold">{r.nombre}</span>
              <span className={r.bien ? " text-[#0F6B57]" : " text-[#B42318]"}> · {r.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
