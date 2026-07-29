/**
 * Marcas de acento (combining diacritical marks). Construída com escapes
 * explícitos para não depender de como o arquivo foi salvo em disco.
 */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

/** "Sábado" -> "sabado" */
export function deaccent(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim()
}
