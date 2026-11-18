"use client";

import { SubidorXml } from "@/components/SubidorXml";
import { subirXmlPorEnlace } from "@/app/clientes/[clienteId]/acciones";

export function EnviarForm({ token }: { token: string }) {
  return <SubidorXml enviar={(datos) => subirXmlPorEnlace(token, datos)} />;
}
