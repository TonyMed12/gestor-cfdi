"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { nombreMes } from "@/lib/formato";

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

type ClienteOpcion ={ id: string; razonSocial: string; periodos: { mesAnio: string; estado: "abierto" | "cerrado" }[] };

// Selector de cliente y periodo del resumen (C6). La selección vive en la URL (?cliente=&periodo=):
// al cambiar cualquiera de los dos, la página se vuelve a calcular y el enlace se puede guardar o compartir.
// Al cambiar de cliente se abre su periodo más reciente.
export function SelectorResumen({
  clientes,
  clienteId,
  periodo,
}: {
  clientes: ClienteOpcion[];
  clienteId: string;
  periodo: string;
}) {
  const router = useRouter();
  const [cargando, iniciar] = useTransition();
  const actual = clientes.find((c) => c.id === clienteId);

  const ir = (cliente: string, mes: string) =>
    iniciar(() => router.push(mes ? `/resumen?cliente=${cliente}&periodo=${mes}` : `/resumen?cliente=${cliente}`));

  return (
    <form
      role="search"
      aria-label="Elegir cliente y periodo"
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface px-5 py-4"
    >
      <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm font-semibold">
        Cliente
        <select
          value={clienteId}
          disabled={cargando}
          onChange={(e) => {
            const elegido = clientes.find((c) => c.id === e.target.value);
            if (elegido) ir(elegido.id, elegido.periodos[0]?.mesAnio ?? "");
          }}
          className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px] font-normal disabled:opacity-60"
        >
          {!actual && <option value="">Elige un cliente</option>}
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razonSocial}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[200px] flex-col gap-1 text-sm font-semibold">
        Periodo
        <select
          value={periodo}
          disabled={cargando || !actual || actual.periodos.length === 0}
          onChange={(e) => actual && ir(actual.id, e.target.value)}
          className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px] font-normal disabled:opacity-60"
        >
          {!actual && <option value="">Primero elige un cliente</option>}
          {actual && actual.periodos.length === 0 && <option value="">Sin periodos</option>}
          {actual?.periodos.map((p) => (
            <option key={p.mesAnio} value={p.mesAnio}>
              {mayuscula(nombreMes(p.mesAnio))}
              {p.estado === "cerrado" ? " · cerrado" : ""}
            </option>
          ))}
        </select>
      </label>
      <span aria-live="polite" className="h-10 text-sm leading-10 text-text-muted">
        {cargando ? "Calculando…" : ""}
      </span>
    </form>
  );
}
