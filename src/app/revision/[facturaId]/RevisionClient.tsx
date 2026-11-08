"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getTotalPorRevisar } from "@/lib/mock-data";
import type { Factura } from "@/lib/types";

export function RevisionClient({ factura }: { factura: Factura }) {
  const [decision, setDecision] = useState<
    "pendiente" | "aceptada" | "corregida" | "rechazada"
  >("pendiente");
  const pendientesIniciales = getTotalPorRevisar();
  const pendientes =
    decision === "pendiente" ? pendientesIniciales : pendientesIniciales - 1;

  const subtotal = factura.conceptos.reduce((s, c) => s + c.importe, 0);
  const iva = factura.conceptos
    .flatMap((c) => c.impuestos)
    .filter((i) => i.impuesto === "IVA")
    .reduce((s, i) => s + i.importe, 0);

  return (
    <AppShell active="/bandeja">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">
            <Link href="/bandeja">Bandeja de revisión</Link> / Factura{" "}
            {factura.relacion}
          </span>
          <h1 className="m-0 text-[30px] font-bold">
            {factura.emisorNombre} · $
            {factura.total.toLocaleString("es-MX", {
              minimumFractionDigits: 2,
            })}
          </h1>
          <span className="text-sm text-text-muted">
            Fuente de datos: XML del CFDI 4.0 (exacto) ·{" "}
            <a href="#">Ver PDF vinculado</a>
          </span>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            decision === "aceptada"
              ? "bg-accent-soft text-accent-soft-text"
              : "bg-warn-soft text-warn-soft-text"
          }`}
        >
          {decision === "aceptada" ? "Clasificado" : "Por revisar"}
        </span>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5.5">
            <h2 className="m-0 text-lg font-semibold">Datos extraídos</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-4 text-[15px]">
              <Dato label="Emisor">
                <span className="font-semibold">{factura.emisorNombre}</span>
                <span className="font-mono text-sm">{factura.emisorRfc}</span>
              </Dato>
              <Dato label="Receptor (tu cliente)">
                <span className="font-semibold">
                  {factura.receptorNombre}
                </span>
                <span className="font-mono text-sm">
                  {factura.receptorRfc}
                </span>
              </Dato>
              <Dato label="Folio fiscal (UUID)">
                <span className="font-mono text-sm break-all">
                  {factura.uuidFiscal}
                </span>
              </Dato>
              <Dato label="Emisión · timbrado">
                <span>
                  {factura.fechaEmision} · {factura.fechaTimbrado}
                </span>
              </Dato>
              <Dato label="Tipo · relación con el cliente">
                <span>
                  {factura.tipoComprobante} Ingreso ·{" "}
                  {factura.relacion === "recibida"
                    ? "recibida (gasto)"
                    : "emitida"}
                </span>
              </Dato>
              <Dato label="Uso de CFDI">
                <span>{factura.usoCfdi}</span>
              </Dato>
              <Dato label="Forma y método de pago">
                <span>
                  {factura.formaPago} · {factura.metodoPago}
                </span>
              </Dato>
              <Dato label="Moneda">
                <span>{factura.moneda}</span>
              </Dato>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#EEF1F4]">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F8FAFB] text-left text-[13px] text-text-muted">
                    <th className="px-3 py-2.5 font-semibold">Clave SAT</th>
                    <th className="px-3 py-2.5 font-semibold">Concepto</th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Cant.
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Importe
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      IVA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {factura.conceptos.map((c, i) => (
                    <tr key={i} className="border-t border-[#EEF1F4]">
                      <td className="px-3 py-2.5 font-mono">
                        {c.claveProdServ}
                      </td>
                      <td className="px-3 py-2.5">{c.descripcion}</td>
                      <td className="px-3 py-2.5 text-right">
                        {c.cantidad}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {c.importe.toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {c.impuestos
                          .reduce((s, i2) => s + i2.importe, 0)
                          .toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-end gap-7 text-[15px]">
              <span>
                Subtotal{" "}
                <span className="font-mono">
                  $
                  {subtotal.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </span>
              <span>
                IVA trasladado{" "}
                <span className="font-mono">
                  ${iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </span>
              <span className="font-bold">
                Total{" "}
                <span className="font-mono">
                  $
                  {factura.total.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5.5">
            <h2 className="m-0 text-lg font-semibold">Validación</h2>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-6 gap-y-2.5 p-0 text-[15px]">
              {[
                "Estructura válida contra el esquema del CFDI 4.0",
                "Conceptos e impuestos suman el total",
                "UUID único en el repositorio",
                "RFC receptor coincide con el cliente",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
              <li className="flex items-start gap-2.5">
                <CheckIcon />
                <span>
                  <strong>Vigente ante el SAT</strong> · consultado el{" "}
                  {new Date(factura.fechaConsultaSat).toLocaleString(
                    "es-MX",
                    { dateStyle: "long", timeStyle: "short" },
                  )}
                </span>
              </li>
            </ul>
          </section>
        </div>

        <section className="box-border flex min-w-0 flex-[2_1_340px] flex-col gap-4.5 rounded-xl border border-border bg-surface p-5.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-semibold">Sugerencia de IA</h2>
            {factura.sugerencia && (
              <span className="rounded-full bg-sat-soft px-2.5 py-1 text-[13px] font-semibold text-sat-soft-text">
                Confianza {factura.sugerencia.confianza}%
              </span>
            )}
          </div>

          {factura.sugerencia ? (
            <>
              <dl className="m-0 flex flex-col gap-3 text-[15px]">
                <Fila label="Categoría">
                  {factura.sugerencia.categoriaSugerida}
                </Fila>
                <Fila label="Deducible">
                  {factura.sugerencia.deducible ? "Sí" : "No"}
                </Fila>
                <Fila label="IVA acreditable">
                  <span className="font-mono">
                    $
                    {factura.sugerencia.ivaAcreditable.toLocaleString(
                      "es-MX",
                      { minimumFractionDigits: 2 },
                    )}
                  </span>
                </Fila>
                <Fila label="Retenciones" last>
                  {factura.sugerencia.retenciones}
                </Fila>
              </dl>

              <div className="flex flex-col gap-2 rounded-lg bg-[#F5F8FB] p-4">
                <span className="text-sm font-semibold">Por qué</span>
                <p className="m-0 text-sm leading-relaxed text-[#374151]">
                  {factura.sugerencia.explicacion}
                </p>
                <span className="text-[13px] text-text-muted">
                  Campos usados: {factura.sugerencia.camposUsados.join(", ")}
                </span>
              </div>
            </>
          ) : (
            <p className="m-0 rounded-lg bg-[#F5F8FB] p-4 text-sm text-text-muted">
              Esta factura ya se clasificó por una regla del contador; no
              necesitó sugerencia de IA.
            </p>
          )}

          {factura.emisorNuevo && (
            <p className="m-0 rounded-lg bg-[#FFF6E6] px-3 py-2.5 text-sm text-warn-soft-text">
              Emisor nuevo: es la primera factura de este proveedor para el
              cliente.
            </p>
          )}

          {decision === "pendiente" ? (
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setDecision("aceptada")}
                className="h-12 rounded-lg bg-accent text-base font-semibold text-white hover:bg-accent-hover"
              >
                Aceptar sugerencia
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setDecision("corregida")}
                  className="h-11 flex-1 rounded-lg border border-[#C9D1DA] bg-surface text-[15px] font-semibold"
                >
                  Corregir
                </button>
                <button
                  type="button"
                  onClick={() => setDecision("rechazada")}
                  className="h-11 flex-1 rounded-lg border border-[#C9D1DA] bg-surface text-[15px] font-semibold"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ) : (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-lg bg-accent-soft p-4"
            >
              <span className="text-[15px] font-semibold text-[#0B4F42]">
                {decision === "aceptada" && "Clasificación aprobada"}
                {decision === "corregida" &&
                  "Corrección guardada (pendiente de completar con la nueva categoría)"}
                {decision === "rechazada" && "Sugerencia rechazada"}
              </span>
              <span className="text-sm text-[#0B4F42]">
                {USUARIO_NOMBRE} ·{" "}
                {new Date().toLocaleString("es-MX", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
                . Quedó en la bitácora
                {decision === "aceptada" &&
                  " y la factura pasa a «Clasificado»."}
                {decision !== "aceptada" && "."}
              </span>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/bandeja"
                  className="inline-flex h-11 items-center rounded-lg border border-accent px-3.5 font-semibold text-accent-soft-text no-underline"
                >
                  Siguiente factura ({pendientes} restantes)
                </Link>
                {decision === "aceptada" && (
                  <Link
                    href="/resumen"
                    className="inline-flex h-11 items-center rounded-lg bg-accent px-3.5 font-semibold text-white no-underline hover:bg-accent-hover"
                  >
                    Ver resumen del periodo
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

const USUARIO_NOMBRE = "Usuario";

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function Fila({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 ${
        last ? "" : "border-b border-[#EEF1F4] pb-2.5"
      }`}
    >
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent-soft-text)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
