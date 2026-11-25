"use client";

import { useState, useSyncExternalStore } from "react";
import { generarEnlaceEnvio } from "./acciones";

// window solo existe en el navegador. En el servidor el origen queda vacío y React lo completa
// al hidratar, sin desajuste entre lo que dibuja el servidor y el navegador.
const sinSuscripcion = () => () => {};
const origenNavegador = () => window.location.origin;
const origenServidor = () => "";

type Enlace = { token: string; venceEn: string };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

export function EnlaceEnvio({ clienteId, enlaceInicial }: {
  clienteId: string;
  enlaceInicial: Enlace | null;
}) {
  const [enlace, setEnlace] = useState<Enlace | null>(enlaceInicial);
  // Solo existe en esta pantalla, justo después de generarla.
  const [contrasenaNueva, setContrasenaNueva] = useState<string | null>(null);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const origen = useSyncExternalStore(sinSuscripcion, origenNavegador, origenServidor);
  const url = enlace ? `${origen}/enviar/${enlace.token}` : "";

  async function generar() {
    setConfirmando(false);
    setError("");
    setEnviando(true);
    const resultado = await generarEnlaceEnvio(clienteId);
    setEnviando(false);
    if (resultado.error || !resultado.token || !resultado.contrasena || !resultado.venceEn) {
      return setError(resultado.error ?? "No se pudo generar el enlace. Intenta de nuevo.");
    }
    setEnlace({ token: resultado.token, venceEn: resultado.venceEn });
    setContrasenaNueva(resultado.contrasena);
    setMostrarContrasena(false);
    setCopiado("");
  }

  async function copiar(texto: string, cual: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(cual);
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">Enlace de envío</h2>
        <p className="m-0 text-[15px] text-text-muted">
          Permite que el cliente suba sus facturas XML sin crear cuenta.
        </p>
      </div>

      {enlace ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Enlace</span>
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-bg px-3 py-2.5 text-sm">{url}</code>
            <button
              type="button"
              onClick={() => copiar(url, "enlace")}
              className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
            >
              {copiado === "enlace" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="m-0 text-sm text-text-muted">Vigente hasta el {fecha(enlace.venceEn)}.</p>
        </div>
      ) : (
        <p className="m-0 text-sm text-text-muted">Aún no se ha generado un enlace para este cliente.</p>
      )}

      {contrasenaNueva && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-4">
          <span className="text-sm font-semibold">Contraseña temporal</span>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-surface px-3 py-2 font-mono text-lg tracking-widest">
              {mostrarContrasena ? contrasenaNueva : "•".repeat(contrasenaNueva.length)}
            </code>
            <button
              type="button"
              onClick={() => setMostrarContrasena((v) => !v)}
              className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
            >
              {mostrarContrasena ? "Ocultar" : "Mostrar"}
            </button>
            <button
              type="button"
              onClick={() => copiar(contrasenaNueva, "contrasena")}
              className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
            >
              {copiado === "contrasena" ? "Copiada" : "Copiar"}
            </button>
          </div>
          <p className="m-0 text-sm text-text-muted">
            Se muestra una sola vez. Compártela por un medio distinto al enlace.
          </p>
        </div>
      )}

      {confirmando ? (
        <div className="flex flex-col gap-3 rounded-lg border border-[#E7C873] bg-[#FFF8E6] p-4">
          <p className="m-0 text-sm">
            El enlace y la contraseña actuales dejarán de funcionar. ¿Quieres generar otros?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={generar}
              disabled={enviando}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {enviando ? "Generando…" : "Sí, generar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => (enlace ? setConfirmando(true) : generar())}
            disabled={enviando}
            className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {enviando ? "Generando…" : enlace ? "Generar nuevo enlace" : "Generar enlace"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 rounded-lg border border-[#F3C2BD] bg-[#FDF0EE] px-3.5 py-2.5 text-sm text-[#B42318]">
          {error}
        </p>
      )}
    </section>
  );
}
