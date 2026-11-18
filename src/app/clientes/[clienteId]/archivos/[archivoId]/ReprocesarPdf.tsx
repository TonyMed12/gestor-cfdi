"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { procesarDocumentoArchivo } from "../../acciones";

// Vuelve a leer un PDF que se quedó sin leer (por ejemplo, subido antes de que existiera la lectura).
export function ReprocesarPdf({ archivoId }: { archivoId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");

  async function leer() {
    setEnviando(true);
    const r = await procesarDocumentoArchivo(archivoId);
    setEnviando(false);
    setTexto(r.texto);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          onClick={leer}
          disabled={enviando}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {enviando ? "Leyendo…" : "Leer el PDF"}
        </button>
      </div>
      {texto && <p role="status" className="m-0 text-sm">{texto}</p>}
    </div>
  );
}
