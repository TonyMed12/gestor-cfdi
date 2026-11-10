"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function NuevoClienteForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    setError("");
    setGuardando(true);
    const { error } = await supabase.from("clientes").insert({
      razon_social: String(datos.get("razon")).trim(),
      rfc: String(datos.get("rfc")).trim().toUpperCase(),
    });
    setGuardando(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Ya tienes un cliente con ese RFC."
          : "No se pudo guardar el cliente.",
      );
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form
      onSubmit={crear}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <label htmlFor="razon" className="text-sm font-semibold">
          Razón social
        </label>
        <input
          id="razon"
          name="razon"
          required
          placeholder="Nombre del cliente"
          className="h-[46px] rounded-lg border border-[#8A96A3] px-3.5 text-[15px]"
        />
      </div>
      <div className="flex min-w-[200px] flex-col gap-2">
        <label htmlFor="rfc" className="text-sm font-semibold">
          RFC
        </label>
        <input
          id="rfc"
          name="rfc"
          required
          pattern="[A-Za-zÑñ&]{3,4}[0-9]{6}[A-Za-z0-9]{3}"
          title="RFC de 12 o 13 caracteres"
          placeholder="RFC del cliente"
          className="h-[46px] rounded-lg border border-[#8A96A3] px-3.5 font-mono text-[15px] uppercase"
        />
      </div>
      <button
        type="submit"
        disabled={guardando}
        className="h-[46px] rounded-lg bg-accent px-5 text-sm font-semibold text-white enabled:hover:bg-accent-hover disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Agregar cliente"}
      </button>
      {error && (
        <p role="alert" className="m-0 basis-full text-sm font-semibold text-warn-soft-text">
          {error}
        </p>
      )}
    </form>
  );
}
