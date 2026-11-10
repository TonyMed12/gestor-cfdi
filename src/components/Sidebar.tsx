import Link from "next/link";
import { BotonSalir } from "./BotonSalir";
import { EnlaceUsuarios } from "./EnlaceUsuarios";
import { Logo } from "./Logo";
import { NOMBRE_APP } from "@/lib/config";
import { getTotalPorRevisar } from "@/lib/mock-data";

const links = [
  { href: "/dashboard", label: "Tablero" },
  { href: "/clientes", label: "Clientes y archivos" },
  { href: "/bandeja", label: "Bandeja de revisión", badge: true },
  { href: "/resumen", label: "Resúmenes por periodo" },
];

// Secciones del menú que todavía no existen: se muestran deshabilitadas en lugar de un enlace a "#".
const proximamente = ["Reglas y categorías"];

export function Sidebar({ active }: { active: string }) {
  const pendientes = getTotalPorRevisar();

  return (
    <nav
      aria-label="Menú principal"
      className="flex w-full flex-col gap-1.5 border-b border-border bg-surface p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r md:p-4"
    >
      <div className="flex items-center gap-2.5 px-2.5 pb-4.5">
        <Logo />
        <span className="text-[17px] font-bold">{NOMBRE_APP}</span>
      </div>
      {links.map((link) => {
        const isActive = link.href === active;
        return (
          <Link
            key={link.label}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-[15px] no-underline ${
              isActive
                ? "bg-accent-soft font-semibold text-accent-soft-text"
                : "text-[#374151] hover:bg-bg focus-visible:bg-bg"
            }`}
          >
            <span>{link.label}</span>
            {link.badge && pendientes > 0 && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[13px] font-semibold text-warn-soft-text">
                {pendientes}
              </span>
            )}
          </Link>
        );
      })}
      {proximamente.map((nombre) => (
        <span
          key={nombre}
          aria-disabled="true"
          title="Disponible próximamente"
          className="flex min-h-11 items-center rounded-lg px-3 text-[15px] text-[#6B7280]"
        >
          {nombre}
        </span>
      ))}
      <EnlaceUsuarios active={active} />
      <BotonSalir />
    </nav>
  );
}
