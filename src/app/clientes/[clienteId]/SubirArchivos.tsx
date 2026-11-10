"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clasificar, extraerZip, huellaSha256, MAX_BYTES, MAX_ZIP_BYTES, nombreSeguro,
  type ArchivoLeido,
} from "@/lib/archivos";
import { registrarAccion } from "@/lib/bitacora";
import { supabase } from "@/lib/supabase";
import { procesarXml } from "./acciones";

type Resultado = { nombre: string; texto: string; bien: boolean };

export function SubirArchivos({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [aviso, setAviso] = useState("");

  async function guardar(archivo: ArchivoLeido, origen?: string): Promise<Resultado> {
    const nombre = origen ? `${origen} › ${archivo.nombre}` : archivo.nombre;
    const clase = clasificar(archivo.nombre, archivo.bytes);
    if ("error" in clase) return { nombre, texto: clase.error, bien: false };

    // Duplicado: mismo contenido ya guardado para este cliente (RF-05).
    // Un archivo que quedó con error no cuenta: se puede volver a subir.
    const huella = await huellaSha256(archivo.bytes);
    const { data: repetido } = await supabase
      .from("archivo").select("id")
      .eq("cliente_id", clienteId).eq("huella_sha256", huella).neq("estado", "error")
      .maybeSingle();
    if (repetido) return { nombre, texto: "Duplicado: ya está en el repositorio", bien: false };

    const id = crypto.randomUUID();
    const ruta = `${clienteId}/${id}/${nombreSeguro(archivo.nombre)}`;
    const { error: errorFila } = await supabase.from("archivo").insert({
      id, cliente_id: clienteId, tipo: clase.tipo, huella_sha256: huella, ruta_original: ruta,
    });
    if (errorFila) {
      return {
        nombre,
        texto: errorFila.code === "23505" ? "Duplicado: ya está en el repositorio" : "No se pudo registrar el archivo",
        bien: false,
      };
    }

    const { error: errorSubida } = await supabase.storage.from("facturas").upload(
      ruta, new Blob([archivo.bytes as BlobPart], { type: clase.mime }), { contentType: clase.mime },
    );
    if (errorSubida) {
      await supabase.from("archivo").update({ estado: "error", motivo_error: "No se pudo subir el archivo" }).eq("id", id);
      return { nombre, texto: "No se pudo subir; vuelve a intentarlo", bien: false };
    }

    let nota = "";
    try {
      await registrarAccion(supabase, "subio", { archivo_id: id, nombre: archivo.nombre, cliente_id: clienteId });
    } catch {
      nota = " (sin registro en la bitácora)";
    }
    if (clase.tipo === "xml") {
      const lectura = await procesarXml(id);
      return { nombre, texto: lectura.texto + nota, bien: lectura.ok };
    }
    return { nombre, texto: "Guardado" + nota, bien: true };
  }

  async function procesar(lista: File[]) {
    setProcesando(true);
    setAviso("");
    const salida: Resultado[] = [];
    const agregar = (r: Resultado) => {
      salida.push(r);
      setResultados([...salida]);
    };
    setResultados([]);

    // Un error inesperado en un archivo (red, servidor) se informa en su renglón y no detiene a los demás.
    const intentar = async (nombre: string, paso: () => Promise<Resultado>) => {
      try {
        agregar(await paso());
      } catch {
        agregar({ nombre, texto: "Error inesperado; vuelve a intentarlo", bien: false });
      }
    };

    try {
      for (const f of lista) {
        if (f.name.toLowerCase().endsWith(".zip")) {
          if (f.size > MAX_ZIP_BYTES) {
            agregar({ nombre: f.name, texto: "El ZIP pasa de 100 MB", bien: false });
            continue;
          }
          let zip: ReturnType<typeof extraerZip>;
          try {
            zip = extraerZip(new Uint8Array(await f.arrayBuffer()));
          } catch {
            zip = { error: "No se pudo leer el ZIP" };
          }
          if ("error" in zip) {
            agregar({ nombre: f.name, texto: zip.error, bien: false });
            continue;
          }
          zip.rechazados.forEach((r) => agregar({ nombre: `${f.name} › ${r.nombre}`, texto: r.motivo, bien: false }));
          if (zip.archivos.length + zip.rechazados.length === 0) {
            agregar({ nombre: f.name, texto: "El ZIP no contiene archivos", bien: false });
          }
          for (const a of zip.archivos) await intentar(`${f.name} › ${a.nombre}`, () => guardar(a, f.name));
        } else if (f.size > MAX_BYTES) {
          agregar({ nombre: f.name, texto: "Pasa de 20 MB", bien: false });
        } else {
          await intentar(f.name, async () => guardar({ nombre: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }));
        }
      }
    } finally {
      // Pase lo que pase, el botón vuelve a quedar disponible y la lista se actualiza.
      setProcesando(false);
      router.refresh();
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <h2 className="m-0 text-lg font-semibold">Subir facturas</h2>
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (procesando) {
            setAviso("Espera a que termine la carga actual y vuelve a soltar los archivos.");
            return;
          }
          procesar(Array.from(e.dataTransfer.files));
        }}
        aria-busy={procesando}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center ${
          arrastrando ? "border-accent bg-accent-soft" : "border-[#8A96A3] bg-bg"
        } ${procesando ? "cursor-wait opacity-60" : ""}`}
      >
        <p className="m-0 text-[15px] text-text-muted">
          Arrastra aquí los archivos XML, PDF, JPG, PNG o un ZIP con varios documentos.
        </p>
        <button
          type="button"
          disabled={procesando}
          onClick={() => entrada.current?.click()}
          className="h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white enabled:hover:bg-accent-hover disabled:opacity-60"
        >
          {procesando ? "Subiendo…" : "Elegir archivos"}
        </button>
        <input
          ref={entrada}
          type="file"
          multiple
          disabled={procesando}
          accept=".xml,.pdf,.jpg,.jpeg,.png,.zip"
          className="hidden"
          onChange={(e) => {
            procesar(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <p className="m-0 text-[13px] text-text-muted">
          El archivo original se conserva sin modificarse. Límite: 20 MB por archivo y 100 MB por ZIP.
        </p>
        {aviso && (
          <p role="status" className="m-0 text-[13px] font-semibold text-warn-soft-text">
            {aviso}
          </p>
        )}
      </div>

      {/* Siempre montada: los lectores de pantalla anuncian mejor una región que ya existía. */}
      <ul aria-live="polite" className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm empty:hidden">
        {resultados.map((r, i) => (
          <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-bg px-3 py-2">
            <span className="font-semibold">{r.nombre}</span>
            <span className={r.bien ? "text-accent-soft-text" : "text-warn-soft-text"}>{r.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
