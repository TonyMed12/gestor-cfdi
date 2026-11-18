"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actualizarCliente, guardarCategoriaCliente, reconsultarMesActual } from "./acciones";

const campo = "h-11 rounded-lg border border-[#8A96A3] bg-surface px-3 text-[15px]";

function Aviso({ texto, tipo }: { texto: string; tipo: "error" | "ok" }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`m-0 rounded-lg border px-3.5 py-2.5 text-sm ${
        tipo === "error" ? "border-[#F3C2BD] bg-[#FDF0EE] text-[#B42318]" : "border-[#B7E4D8] bg-[#EEF9F5] text-[#0F6B57]"
      }`}
    >
      {texto}
    </p>
  );
}

export function EditarCliente({ clienteId, razonSocial, activo }: {
  clienteId: string;
  razonSocial: string;
  activo: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const resultado = await actualizarCliente(clienteId, new FormData(e.currentTarget));
    setEnviando(false);
    if (resultado.error) return setError(resultado.error);
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Razón social
        <input name="razon_social" required maxLength={160} defaultValue={razonSocial} className={campo} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={activo} className="h-4 w-4" />
        Cliente activo (recibe facturas nuevas)
      </label>
      <div>
        <button
          type="submit"
          disabled={enviando}
          className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
      {error && <Aviso texto={error} tipo="error" />}
    </form>
  );
}

export function CategoriasDelCliente({ clienteId, categorias }: {
  clienteId: string;
  categorias: { id: string; nombre: string; deducibleDefault: boolean }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function agregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setEnviando(true);
    const resultado = await guardarCategoriaCliente(clienteId, new FormData(form));
    setEnviando(false);
    if (resultado.error) return setError(resultado.error);
    form.reset();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {categorias.length === 0 ? (
        <p className="m-0 text-sm text-text-muted">Este cliente todavía no tiene categorías propias.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
          {categorias.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{c.nombre}</span>
              <span className="text-text-muted">{c.deducibleDefault ? "Deducible" : "No deducible"}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-2 text-sm font-semibold">
          Nueva categoría
          <input name="nombre" required maxLength={60} placeholder="Nombre" className={campo} />
        </label>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="deducible" defaultChecked className="h-4 w-4" />
          Deducible
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Agregar"}
        </button>
      </form>
      {error && <Aviso texto={error} tipo="error" />}
    </div>
  );
}

export function ReconsultarMes({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function reconsultar() {
    setEnviando(true);
    setResultado(null);
    const r = await reconsultarMesActual(clienteId);
    setEnviando(false);
    setResultado(r);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={reconsultar}
          disabled={enviando}
          className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-4 text-sm font-semibold hover:bg-bg disabled:opacity-60"
        >
          {enviando ? "Consultando al SAT…" : "Consultar de nuevo las facturas del mes"}
        </button>
      </div>
      {resultado && <Aviso texto={resultado.texto} tipo={resultado.ok ? "ok" : "error"} />}
    </div>
  );
}
