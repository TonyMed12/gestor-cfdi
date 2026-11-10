import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NOMBRE_APP } from "@/lib/config";
import { getPerfil, getUsuarios } from "@/lib/datos";
import { BotonEstadoUsuario } from "./BotonEstadoUsuario";
import { NuevoUsuarioForm } from "./NuevoUsuarioForm";

export const metadata = { title: `Usuarios · ${NOMBRE_APP}` };

export default async function UsuariosPage() {
  const perfil = await getPerfil();
  if (perfil?.rol !== "administrador") redirect("/dashboard");
  const usuarios = await getUsuarios();

  return (
    <AppShell active="/usuarios">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[30px] font-bold">Usuarios del despacho</h1>
        <p className="m-0 text-[15px] text-text-muted">
          Personas que pueden entrar a la aplicación y su rol.
        </p>
      </header>

      <NuevoUsuarioForm />

      <section className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-text-muted">
              <th className="px-5 py-3.5 font-semibold">Nombre</th>
              <th className="px-3 py-3.5 font-semibold">Correo</th>
              <th className="px-3 py-3.5 font-semibold">Rol</th>
              <th className="px-3 py-3.5 font-semibold">Estado</th>
              <th className="px-5 py-3.5">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-[#EEF1F4]">
                <td className="px-5 py-3.5 font-semibold">{u.nombre}</td>
                <td className="px-3 py-3.5">{u.correo}</td>
                <td className="px-3 py-3.5 capitalize">{u.rol}</td>
                <td className="px-3 py-3.5">
                  <Badge variant={u.activo ? "success" : "neutral"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {u.id === perfil.id ? (
                    <span className="text-sm text-text-muted">Tú</span>
                  ) : (
                    <BotonEstadoUsuario id={u.id} activo={u.activo} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
