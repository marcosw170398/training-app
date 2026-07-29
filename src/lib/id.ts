/**
 * Ids são UUIDs de string (não auto-increment) porque backup/import precisa
 * mover registros entre dispositivos sem colisão de chave.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback para contextos não-seguros (http em rede local, por exemplo).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
