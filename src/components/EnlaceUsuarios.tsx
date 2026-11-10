"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Solo oculta o muestra el enlace; la página /usuarios vuelve a comprobar el rol en el servidor.
export function EnlaceUsuarios({ active }: { active: string }) {
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("usuario")
        .select("rol")
        .eq("id", user.id)
        .maybeSingle();
      setEsAdmin(data?.rol === "administrador");
    });
  }, []);

  if (!esAdmin) return null;
  const isActive = active === "/usuarios";
  return (
    <Link
      href="/usuarios"
      aria-current={isActive ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-lg px-3 text-[15px] no-underline ${
        isActive
          ? "bg-accent-soft font-semibold text-accent-soft-text"
          : "text-[#374151] hover:bg-bg focus-visible:bg-bg"
      }`}
    >
      Usuarios
    </Link>
  );
}
