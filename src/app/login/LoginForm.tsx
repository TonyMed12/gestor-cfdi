"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const datos = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(datos.get("correo")),
      password: String(datos.get("contrasena")),
    });
    setCargando(false);
    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="correo" className="text-sm font-semibold">
          Correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          required
          autoComplete="email"
          placeholder="correo@despacho.mx"
          className="h-[46px] rounded-lg border border-[#C9D1DA] px-3.5 text-[15px]"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="contrasena" className="text-sm font-semibold">
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Tu contraseña"
          className="h-[46px] rounded-lg border border-[#C9D1DA] px-3.5 text-[15px]"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="codigo" className="text-sm font-semibold">
          Código de verificación (2 pasos)
        </label>
        <input
          id="codigo"
          inputMode="numeric"
          disabled
          placeholder="000 000"
          className="h-[46px] rounded-lg border border-[#C9D1DA] bg-bg px-3.5 font-mono text-lg tracking-[0.2em] disabled:cursor-not-allowed"
        />
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-warn-soft-text">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={cargando}
        className="flex h-12 items-center justify-center rounded-lg bg-accent text-base font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {cargando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
