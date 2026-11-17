"use client";

import { useState } from "react";
import { generarEnlaceEnvio } from "./acciones";

type Enlace = { token: string; venceEn: string };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

// Enlace + contraseña temporal para que el cliente suba sus XML. Regenerar invalida lo anterior.
export function EnlaceEnvio({ clienteId, enlaceInicial }: {
  clienteId: string;
  enlaceInicial: Enlace | null;
}) {
  const [enlace, setEnlace] = useState<Enlace | null>(enlaceInicial);
  // La contraseña solo existe en esta pantalla, justo después de generarla.
  const [contrasenaNueva, setContrasenaNueva] = useState<string | null>(null);
  const [copiado, setCopiado] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const url = enlace ? `${window.location.origin}/enviar/${enlace.token}` : "";

  async function generar() {
    if (enlace && !window.confirm("El enlace y la contraseña actuales dejarán de funcionar. ¿Generar otros?")) return;
    setError("");
    setEnviando(true);
    const resultado = await generarEnlaceEnvio(clienteId);
    setEnviando(false);
    if (resultado.error || !resultado.token || !resultado.contrasena || !resultado.venceEn) {
      return setError(resultado.error ?? "No se pudo generar el enlace.");
    }
    setEnlace({ token: resultado.token, venceEn: resultado.venceEn });
    setContrasenaNueva(resultado.contrasena);
    setCopiado("");
  }

  async function copiar(texto: string, cual: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(cual);
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">Enlace para que el cliente envíe sus facturas</h2>
        <p className="m-0 text-[15px] text-text-muted">
          Tu cliente sube sus XML con el enlace y la contraseña, sin crear cuenta. Solo recibe XML; los PDF y
          escaneos los sigues cargando tú.
        </p>
      </div>

      {enlace ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-bg px-3 py-2.5 text-sm">{url}</code>
            <button
              type="button"
              onClick={() => copiar(url, "enlace")}
              className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
            >
              {copiado === "enlace" ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
          <p className="m-0 text-sm text-text-muted">Vence el {fecha(enlace.venceEn)}.</p>
        </div>
      ) : (
        <p className="m-0 text-sm text-text-muted">Este cliente todavía no tiene enlace.</p>
      )}

      {contrasenaNueva && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#E7C873] bg-[#FFF8E6] p-4">
          <span className="text-sm font-semibold">Contraseña del cliente</span>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-surface px-3 py-2 font-mono text-lg tracking-widest">{contrasenaNueva}</code>
            <button
              type="button"
              onClick={() => copiar(contrasenaNueva, "contrasena")}
              className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
            >
              {copiado === "contrasena" ? "Copiada" : "Copiar"}
            </button>
          </div>
          <p className="m-0 text-sm text-text-muted">
            Solo se muestra esta vez. Mándala por un medio distinto al enlace (por ejemplo, en un mensaje aparte).
          </p>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={generar}
          disabled={enviando}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {enviando ? "Generando…" : enlace ? "Generar otro enlace y contraseña" : "Generar enlace y contraseña"}
        </button>
      </div>
      {error && <p role="alert" className="m-0 text-sm text-[#B42318]">{error}</p>}
    </section>
  );
}
