import type { Cliente } from "./types";
import { supabaseServidor } from "./supabase-servidor";

type FilaCliente = { id: string; razon_social: string; rfc: string };

// Convierte las columnas de la base (razon_social) a los campos de la app (razonSocial).
// Los contadores quedan en 0 hasta que exista la tabla de facturas.
const aCliente = (f: FilaCliente): Cliente => ({
  id: f.id,
  razonSocial: f.razon_social,
  rfc: f.rfc,
  sinLeer: 0,
  porRevisar: 0,
  conError: 0,
  faltantes: 0,
});

export async function getClientes(): Promise<Cliente[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, razon_social, rfc")
    .order("razon_social");
  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`);
  return data.map(aCliente);
}

export async function getCliente(id: string): Promise<Cliente | undefined> {
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("clientes")
    .select("id, razon_social, rfc")
    .eq("id", id)
    .maybeSingle();
  return data ? aCliente(data) : undefined;
}
