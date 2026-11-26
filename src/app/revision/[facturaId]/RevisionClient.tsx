"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { deduccionesDeFactura } from "@/lib/deducibilidad";
import { MOTIVO_MAXIMO, MOTIVO_MINIMO } from "@/lib/cierre";
import { mesDeFecha, nombreMes } from "@/lib/formato";
import type { Factura, OrigenClasificacion } from "@/lib/types";
import { aprobarFactura, guardarDeducible, rechazarFactura } from "./acciones";

const etiquetaOrigen: Record<OrigenClasificacion, string> = {
  regla: "Clave asignada a mano",
  emisor: "Regla por emisor",
  base: "Regla base (palabra clave)",
  division: "Sugerida por la clave del SAT",
  ia: "Sugerencia de IA",
};

type Categoria = { id: string; nombre: string; deducible: boolean };
type Modo = "vista" | "corregir" | "rechazar";

type CambioCategoria = {
  categoria_anterior: string | null;
  categoria_nueva: string;
  cambiado_en: string;
  cambiado_por: string;
  concepto: string;
};

export function RevisionClient({ factura, categorias, historial }: {
  factura: Factura;
  categorias: Categoria[];
  historial: CambioCategoria[];
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("vista");
  // conceptoId → categoriaId, solo para los conceptos que el contador cambia.
  const [corregidas, setCorregidas] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  // D4: en un periodo cerrado, aprobar, corregir o rechazar pide el motivo del cambio (queda en la bitácora).
  const [motivoCierre, setMotivoCierre] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const aprobada = factura.estadoRevision === "clasificado";
  const rechazada = factura.estadoRevision === "excluido";
  const idPorNombre = new Map(categorias.map((c) => [c.nombre, c.id]));
  const sinClasificar = factura.conceptos.some((c) => !c.categoria);
  const periodoCerrado = factura.periodoCerrado ?? null;
  const faltaMotivoCierre = Boolean(periodoCerrado) && motivoCierre.trim().length < MOTIVO_MINIMO;

  const valorCategoria = (conceptoId: string | undefined, categoria: string | undefined) =>
    (conceptoId && corregidas[conceptoId]) || (categoria ? idPorNombre.get(categoria) ?? "" : "");

  async function aprobar() {
    setError("");
    setEnviando(true);
    const resultado = await aprobarFactura(factura.id, corregidas, periodoCerrado ? motivoCierre : undefined);
    setEnviando(false);
    if (resultado.error) return setError(resultado.error);
    setModo("vista");
    router.refresh();
  }

  // Los selectores de categoría están en la tabla de conceptos, lejos del botón «Corregir»:
  // al entrar al modo de corrección, la página lleva al primer selector.
  function irAConceptos() {
    const tabla = document.getElementById("conceptos");
    tabla?.scrollIntoView({ behavior: "smooth", block: "center" });
    tabla?.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
  }

  function iniciarCorreccion() {
    setModo("corregir");
    // Espera a que se dibujen los selectores antes de llevar ahí la vista.
    requestAnimationFrame(() => requestAnimationFrame(irAConceptos));
  }

  async function rechazar() {
    setError("");
    setEnviando(true);
    const resultado = await rechazarFactura(factura.id, motivo, periodoCerrado ? motivoCierre : undefined);
    setEnviando(false);
    if (resultado.error) return setError(resultado.error);
    setModo("vista");
    router.refresh();
  }

  const subtotal = factura.conceptos.reduce((s, c) => s + c.importe, 0);
  const ivaTrasladadoDe = (c: Factura["conceptos"][number]) =>
    c.impuestos.filter((i) => i.impuesto === "IVA" && i.tipo === "trasladado").reduce((s, i) => s + i.importe, 0);
  const iva = factura.conceptos.reduce((s, c) => s + ivaTrasladadoDe(c), 0);

  // Deducibilidad (A7): la marca de la factura gana sobre la de la categoría de cada concepto.
  // Con "Corregir", cuenta la categoría que el contador está eligiendo.
  const categoriaPorId = new Map(categorias.map((k) => [k.id, k]));
  const categoriaPorNombre = new Map(categorias.map((k) => [k.nombre, k]));
  const recibida = factura.relacion === "recibida";
  const editable = !aprobada && !rechazada;
  const [marca, setMarca] = useState<boolean | null>(factura.deducible ?? null);
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const deducciones = deduccionesDeFactura({
    relacion: factura.relacion,
    marca,
    conceptos: factura.conceptos.map((c) => {
      const categoria = (c.id && corregidas[c.id] && categoriaPorId.get(corregidas[c.id])) ||
        (c.categoria ? categoriaPorNombre.get(c.categoria) : undefined);
      return { importe: c.importe, impuestos: c.impuestos, deducibleCategoria: categoria?.deducible };
    }),
  });
  const categoriasNoDeducibles = factura.conceptos.some((c) => c.categoria && categoriaPorNombre.get(c.categoria)?.deducible === false);

  async function cambiarMarca(valor: "categoria" | "si" | "no") {
    const anterior = marca;
    setMarca(valor === "categoria" ? null : valor === "si");
    setError("");
    setGuardandoMarca(true);
    const resultado = await guardarDeducible(factura.id, valor);
    setGuardandoMarca(false);
    if (resultado.error) {
      setMarca(anterior);
      setError(resultado.error);
    } else {
      router.refresh();
    }
  }

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
            {factura.fuente === "pdf"
              ? "Fuente de datos: representación impresa en PDF. Confirma los datos cuando llegue el XML."
              : "Fuente de datos: XML del CFDI 4.0 (exacto)."}
          </span>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            aprobada
              ? "bg-accent-soft text-accent-soft-text"
              : rechazada
                ? "bg-[#FDF0EE] text-[#B42318]"
                : "bg-warn-soft text-warn-soft-text"
          }`}
        >
          {aprobada ? "Clasificado" : rechazada ? "Rechazada" : "Por revisar"}
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
              <Dato label="Régimen fiscal del receptor">
                <span>{factura.regimenReceptor ?? "—"}</span>
              </Dato>
              <Dato label="Forma y método de pago">
                <span>
                  {factura.formaPago ?? "—"} · {factura.metodoPago ?? "—"}
                </span>
              </Dato>
              <Dato label="Moneda">
                <span>{factura.moneda}</span>
              </Dato>
            </div>

            <div id="conceptos" className="overflow-x-auto rounded-lg border border-[#EEF1F4] scroll-mt-6">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F8FAFB] text-left text-[13px] text-text-muted">
                    <th className="px-3 py-2.5 font-semibold">Clave SAT</th>
                    <th className="px-3 py-2.5 font-semibold">Concepto</th>
                    <th className="px-3 py-2.5 font-semibold">Categoría</th>
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
                    <tr key={c.id ?? i} className="border-t border-[#EEF1F4]">
                      <td className="px-3 py-2.5 font-mono">
                        {c.claveProdServ}
                      </td>
                      <td className="px-3 py-2.5">{c.descripcion}</td>
                      <td className="px-3 py-2.5">
                        {modo === "corregir" ? (
                          <select
                            aria-label={`Categoría de ${c.descripcion}`}
                            value={valorCategoria(c.id, c.categoria)}
                            onChange={(e) =>
                              setCorregidas((prev) => ({ ...prev, [c.id ?? ""]: e.target.value }))
                            }
                            className="h-9 w-full min-w-[220px] rounded-lg border border-[#8A96A3] bg-surface px-2 text-sm"
                          >
                            <option value="">Elige una categoría</option>
                            {categorias.map((k) => (
                              <option key={k.id} value={k.id}>{k.nombre}</option>
                            ))}
                          </select>
                        ) : c.categoria ? (
                          <>
                            <span className="font-semibold">{c.categoria}</span>
                            <span className="block text-[13px] text-text-muted">
                              {aprobada ? "Aprobada" : etiquetaOrigen[c.origen ?? "division"]}
                            </span>
                          </>
                        ) : (
                          <span className="text-text-muted">Sin clasificar</span>
                        )}
                      </td>
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
            <h2 className="m-0 text-lg font-semibold">Clasificación</h2>
            {factura.sugerencia && (
              <span className="rounded-full bg-sat-soft px-2.5 py-1 text-[13px] font-semibold text-sat-soft-text">
                Confianza {factura.sugerencia.confianza}%
              </span>
            )}
          </div>

          <dl className="m-0 flex flex-col gap-3 text-[15px]">
            <Fila label="Categoría propuesta">{factura.categoriaPropuesta}</Fila>
            {recibida && (
              <Fila label="Gasto deducible">
                <span className="font-mono">
                  ${deducciones.gastoDeducible.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </Fila>
            )}
            <Fila label="IVA acreditable" last>
              <span className="font-mono">
                ${deducciones.ivaAcreditable.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </Fila>
          </dl>

          {recibida ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="deducible" className="text-sm font-semibold">
                Deducibilidad de la factura
              </label>
              {editable ? (
                <select
                  id="deducible"
                  value={marca === null ? "categoria" : marca ? "si" : "no"}
                  disabled={guardandoMarca || enviando}
                  onChange={(e) => cambiarMarca(e.target.value as "categoria" | "si" | "no")}
                  className="h-10 rounded-lg border border-[#8A96A3] bg-surface px-2.5 text-[15px] disabled:opacity-60"
                >
                  <option value="categoria">Según la categoría de cada concepto</option>
                  <option value="si">Deducible</option>
                  <option value="no">No deducible</option>
                </select>
              ) : (
                <span className="text-[15px]">
                  {marca === null ? "Según la categoría de cada concepto" : marca ? "Deducible" : "No deducible"}
                </span>
              )}
              <span className="text-[13px] text-text-muted">
                {marca === null
                  ? categoriasNoDeducibles
                    ? "Algún concepto está en una categoría no deducible: su importe e IVA no se cuentan."
                    : "Todos los conceptos están en categorías deducibles."
                  : marca
                    ? "Toda la factura se deduce y su IVA se acredita, sin importar la categoría."
                    : "Nada de esta factura se deduce ni se acredita, sin importar la categoría."}
              </span>
            </div>
          ) : (
            <p className="m-0 text-[13px] text-text-muted">
              Factura emitida: es un ingreso, así que no tiene deducciones ni IVA acreditable.
            </p>
          )}

          {factura.emisorNuevo && (
            <p className="m-0 rounded-lg bg-[#FFF6E6] px-3 py-2.5 text-sm text-warn-soft-text">
              Emisor nuevo: es la primera factura de este proveedor para el
              cliente.
            </p>
          )}

          {aprobada && (
            <div role="status" className="flex flex-col gap-3 rounded-lg bg-accent-soft p-4">
              <span className="text-[15px] font-semibold text-[#0B4F42]">Clasificación aprobada</span>
              <span className="text-sm text-[#0B4F42]">Quedó registrada en la bitácora.</span>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/bandeja"
                  className="inline-flex h-11 items-center rounded-lg border border-accent px-3.5 font-semibold text-accent-soft-text no-underline"
                >
                  Volver a la bandeja
                </Link>
                <Link
                  href={`/resumen?cliente=${factura.clienteId}&periodo=${mesDeFecha(factura.fechaEmision)}`}
                  className="inline-flex h-11 items-center rounded-lg bg-accent px-3.5 font-semibold text-white no-underline hover:bg-accent-hover"
                >
                  Ver resumen del periodo
                </Link>
              </div>
            </div>
          )}

          {rechazada && (
            <div role="status" className="flex flex-col gap-3 rounded-lg bg-[#FDF0EE] p-4">
              <span className="text-[15px] font-semibold text-[#B42318]">Factura rechazada</span>
              <span className="text-sm text-[#B42318]">Motivo: {factura.motivoExclusion}</span>
              <Link href="/bandeja" className="font-semibold text-accent-soft-text">Volver a la bandeja</Link>
            </div>
          )}

          {!aprobada && !rechazada && periodoCerrado && (
            <div role="note" className="flex flex-col gap-2 rounded-lg border border-[#E7C873] bg-[#FFF8E6] p-4">
              <span className="text-[15px] font-semibold">
                Periodo cerrado: <span className="capitalize">{nombreMes(periodoCerrado)}</span>
              </span>
              <span className="text-sm">
                Esta factura es de un mes que ya se cerró. Para aprobarla, corregirla o rechazarla escribe el motivo;
                queda en la bitácora con tu nombre.
              </span>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Motivo del cambio
                <textarea
                  value={motivoCierre}
                  onChange={(e) => setMotivoCierre(e.target.value)}
                  maxLength={MOTIVO_MAXIMO}
                  rows={2}
                  placeholder="Por ejemplo: la factura del proveedor llegó después del cierre"
                  aria-describedby="ayuda-motivo-cierre"
                  className="rounded-lg border border-[#8A96A3] bg-surface px-3 py-2 text-[15px] font-normal"
                />
              </label>
              <span id="ayuda-motivo-cierre" className="text-[13px] text-text-muted">
                Al menos {MOTIVO_MINIMO} letras.
              </span>
            </div>
          )}

          {!aprobada && !rechazada && modo === "vista" && (
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={aprobar}
                disabled={sinClasificar || enviando || faltaMotivoCierre}
                className="h-12 rounded-lg bg-accent text-base font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Aprobar clasificación
              </button>
              {sinClasificar && (
                <p className="m-0 text-sm text-text-muted">
                  Hay conceptos sin categoría. Corrígelos para poder aprobar.
                </p>
              )}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={iniciarCorreccion}
                  className="h-11 flex-1 rounded-lg border border-[#C9D1DA] bg-surface text-[15px] font-semibold"
                >
                  Corregir
                </button>
                <button
                  type="button"
                  onClick={() => setModo("rechazar")}
                  className="h-11 flex-1 rounded-lg border border-[#C9D1DA] bg-surface text-[15px] font-semibold"
                >
                  Rechazar
                </button>
              </div>
            </div>
          )}

          {!aprobada && !rechazada && modo === "corregir" && (
            <div className="flex flex-col gap-2.5">
              <p className="m-0 text-sm text-text-muted">
                Cambia la categoría de cada concepto en la{" "}
                <a href="#conceptos" onClick={(e) => { e.preventDefault(); irAConceptos(); }} className="font-semibold">
                  tabla de conceptos
                </a>{" "}
                y luego aprueba. Al aprobar, queda fija y el cambio se guarda en el historial.
              </p>
              <button
                type="button"
                onClick={aprobar}
                disabled={enviando || faltaMotivoCierre}
                className="h-12 rounded-lg bg-accent text-base font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {enviando ? "Guardando…" : Object.keys(corregidas).length > 0 ? "Guardar corrección y aprobar" : "Aprobar"}
              </button>
              <button
                type="button"
                onClick={() => { setModo("vista"); setCorregidas({}); setError(""); }}
                className="h-11 rounded-lg border border-[#C9D1DA] bg-surface text-[15px] font-semibold"
              >
                Cancelar
              </button>
            </div>
          )}

          {!aprobada && !rechazada && modo === "rechazar" && (
            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Motivo del rechazo
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={200}
                  rows={3}
                  className="rounded-lg border border-[#8A96A3] bg-surface px-3 py-2 text-[15px] font-normal"
                />
              </label>
              <button
                type="button"
                onClick={rechazar}
                disabled={enviando || faltaMotivoCierre}
                className="h-12 rounded-lg bg-[#B42318] text-base font-semibold text-white disabled:opacity-60"
              >
                {enviando ? "Guardando…" : "Confirmar rechazo"}
              </button>
              <button
                type="button"
                onClick={() => { setModo("vista"); setError(""); }}
                className="h-11 rounded-lg border border-[#C9D1DA] bg-surface text-[15px] font-semibold"
              >
                Cancelar
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="m-0 rounded-lg border border-[#F3C2BD] bg-[#FDF0EE] px-3.5 py-2.5 text-sm text-[#B42318]">
              {error}
            </p>
          )}

          {historial.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[#EEF1F4] pt-4">
              <span className="text-sm font-semibold">Cambios de categoría</span>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px]">
                {historial.map((h, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    {factura.conceptos.length > 1 && h.concepto && (
                      <span className="text-text-muted">{h.concepto}</span>
                    )}
                    <span>
                      <span className="text-text-muted">{h.categoria_anterior ?? "Sin categoría"}</span> →{" "}
                      <span className="font-semibold">{h.categoria_nueva}</span>
                    </span>
                    <span className="text-text-muted">
                      {new Date(h.cambiado_en).toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Mexico_City",
                      })}{" "}
                      · {h.cambiado_por}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

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
