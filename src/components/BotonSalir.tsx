"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function BotonSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    // "local": cierra la sesión de este navegador; las de otros dispositivos siguen abiertas.
    await supabase.auth.signOut({ scope: "local" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="mt-auto flex min-h-11 items-center rounded-lg px-3 text-left text-[15px] text-[#374151] enabled:hover:bg-bg disabled:opacity-60"
    >
      {saliendo ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
