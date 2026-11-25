// Búsqueda por folio fiscal (UUID) (B1). Sin dependencias, para poder probarla sola.

export const MINIMO_FRAGMENTO_UUID = 4;

const FORMATO_UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

export type BusquedaUuid =
  | { tipo: "vacia" }
  | { tipo: "completo"; uuid: string }
  | { tipo: "fragmento"; fragmento: string }
  | { tipo: "invalida"; error: string };

// Limpia lo que escribe el usuario. Los UUID se guardan en mayúsculas, así que se convierte a
// mayúsculas y se quitan espacios. Un UUID completo se busca exacto; un fragmento, como parte del folio.
export function interpretarBusquedaUuid(texto: string | null | undefined): BusquedaUuid {
  const limpio = (texto ?? "").replace(/\s+/g, "").toUpperCase();
  if (limpio === "") return { tipo: "vacia" };
  if (!/^[0-9A-F-]+$/.test(limpio)) {
    return { tipo: "invalida", error: "Un folio fiscal solo tiene números, letras de la A a la F y guiones." };
  }
  if (FORMATO_UUID.test(limpio)) return { tipo: "completo", uuid: limpio };
  if (limpio.replace(/-/g, "").length < MINIMO_FRAGMENTO_UUID) {
    return { tipo: "invalida", error: `Escribe al menos ${MINIMO_FRAGMENTO_UUID} caracteres del folio fiscal.` };
  }
  return { tipo: "fragmento", fragmento: limpio };
}
