"use client";

import { useState } from "react";
import type { ResultadoEnvio } from "@/app/clientes/[clienteId]/acciones";

type Respuesta = { resultados: ResultadoEnvio[]; error?: string };

export function SubidorXml({
  enviar,
  etiqueta = "Seleccionar archivos XML",
  aceptar = ".xml,application/xml,text/xml",
}: {
  enviar: (datos: FormData) => Promise<Respuesta>;
  etiqueta?: string;
  aceptar?: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [resultados, setResultados] = useState<ResultadoEnvio[]>([]);

  async function subir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setResultados([]);
    setEnviando(true);
    const respuesta = await enviar(new FormData(form));
    setEnviando(false);
    if (respuesta.error) return setError(respuesta.error);
    setResultados(respuesta.resultados);
    if (respuesta.resultados.every((r) => r.bien)) {
      form.reset();
      setSeleccion([]);
    }
  }

  return (
    <form onSubmit={subir} className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-3">
        <input
          id="archivos-xml"
          type="file"
          name="archivos"
          accept={aceptar}
          multiple
          onChange={(e) => setSeleccion(Array.from(e.currentTarget.files ?? []).map((f) => f.name))}
          className="sr-only"
        />
        <label
          htmlFor="archivos-xml"
          className="inline-flex h-11 w-fit cursor-pointer items-center rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold hover:bg-bg"
        >
          {etiqueta}
        </label>
        <p className="m-0 text-sm text-text-muted">
          {seleccion.length === 0
            ? "Hasta 20 archivos."
            : `${seleccion.length} ${seleccion.length === 1 ? "archivo seleccionado" : "archivos seleccionados"}`}
        </p>
        {seleccion.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {seleccion.map((n) => <li key={n} className="truncate">{n}</li>)}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={enviando || seleccion.length === 0}
        className="h-12 rounded-lg bg-accent px-4 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviar facturas"}
      </button>

      {error && (
        <p role="alert" className="m-0 rounded-lg border border-[#F3C2BD] bg-[#FDF0EE] px-3.5 py-2.5 text-sm text-[#B42318]">
          {error}
        </p>
      )}

      {resultados.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {resultados.map((r, i) => (
            <li
              key={i}
              className={`rounded-lg border px-3.5 py-2.5 text-sm ${
                r.bien ? "border-[#B7E4D8] bg-[#EEF9F5] text-[#0F6B57]" : "border-[#F3C2BD] bg-[#FDF0EE] text-[#B42318]"
              }`}
            >
              <span className="font-semibold">{r.nombre}</span> · {r.texto}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
