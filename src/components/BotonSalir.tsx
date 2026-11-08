"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function BotonSalir() {
  const router = useRouter();

  async function salir() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={salir}
      className="mt-auto flex min-h-11 items-center rounded-lg px-3 text-left text-[15px] text-[#374151] hover:bg-bg"
    >
      Cerrar sesión
    </button>
  );
}
