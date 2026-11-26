"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cerrarPeriodo } from "./acciones";

// Botón «Cerrar periodo» del resumen (D4), con confirmación. Si quedan facturas por revisar, no deja cerrar
// y lleva a la bandeja con el cliente y el periodo ya filtrados.
export function CerrarPeriodo({
  clienteId,
  mesAnio,
  nombreMes,
  pendientes,
  motivoNoCerrar,
}: {
  clienteId: string;
  mesAnio: string;
  nombreMes: string;
  pendientes: number;
  motivoNoCerrar?: string;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function cerrar() {
    setError("");
    setEnviando(true);
    const r = await cerrarPeriodo(clienteId, mesAnio);
    setEnviando(false);
    if (r.error) return setError(r.error);
    setConfirmando(false);
    router.refresh();
  }

  if (pendientes > 0) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          aria-describedby="no-cerrar"
          className="h-11 w-fit rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Cerrar periodo
        </button>
        <p id="no-cerrar" className="m-0 text-sm text-text-muted">
          {motivoNoCerrar}{" "}
          <Link href={`/bandeja?cliente=${clienteId}&periodo=${mesAnio}`} className="font-semibold">
            Ver en la bandeja
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="h-11 w-fit rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Cerrar periodo
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="titulo-cerrar" className="flex flex-col gap-3 rounded-lg border border-[#E7C873] bg-[#FFF8E6] p-4">
          <p id="titulo-cerrar" className="m-0 text-[15px] font-semibold">
            ¿Cerrar <span className="capitalize">{nombreMes}</span>?
          </p>
          <ul className="m-0 flex flex-col gap-1 pl-5 text-sm">
            <li>El resumen de este mes queda fijo.</li>
            <li>Aprobar, corregir o rechazar una factura de este periodo pedirá un motivo, que queda en la bitácora.</li>
            <li>Un periodo cerrado no se puede reabrir.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={cerrar}
              disabled={enviando}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {enviando ? "Cerrando…" : "Sí, cerrar el periodo"}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmando(false); setError(""); }}
              disabled={enviando}
              className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
}
