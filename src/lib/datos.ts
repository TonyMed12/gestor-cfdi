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

export type Perfil = { id: string; nombre: string; rol: string; despacho: string };

// Datos de la persona en sesión; es undefined si no tiene fila en la tabla usuario.
export async function getPerfil(): Promise<Perfil | undefined> {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;
  const { data } = await supabase
    .from("usuario")
    .select("nombre, rol, despacho(nombre)")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return undefined;
  const despacho = data.despacho as unknown as { nombre: string } | null;
  return { id: user.id, nombre: data.nombre, rol: data.rol, despacho: despacho?.nombre ?? "" };
}

export type UsuarioDespacho = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  activo: boolean;
};

export async function getUsuarios(): Promise<UsuarioDespacho[]> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre, correo, rol, activo")
    .order("nombre");
  if (error) throw new Error(`No se pudieron leer los usuarios: ${error.message}`);
  return data;
}

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
