// RFC que aparecen en un texto. Se buscan en mayúsculas; el OCR puede fallar en algunas letras.
const RFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g;

export function rfcsEn(texto: string): string[] {
  return [...new Set(texto.toUpperCase().match(RFC) ?? [])];
}
