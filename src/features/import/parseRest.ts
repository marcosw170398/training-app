import { deaccent } from '@/lib/text'

export interface ParsedRest {
  restSecondsMin: number | null
  restSecondsMax: number | null
  restNote: string | null
}

const VAZIO: ParsedRest = { restSecondsMin: null, restSecondsMax: null, restNote: null }

/**
 * Interpreta a coluna "Intervalo" do plano.
 *
 * "90 - 120 segundos"      -> 90 a 120
 * "40 segundos"            -> 40
 * "2 minutos"              -> 120
 * "1 minuto e 30 segundos" -> 90
 * "Um lado após o outro"   -> restNote (sem cronômetro)
 *
 * Texto que não vira número NÃO é descartado nem chutado como zero: vai para
 * `restNote` e a série simplesmente não dispara cronômetro, que é o
 * comportamento prescrito pelo plano.
 */
export function parseRest(raw: string | undefined | null): ParsedRest {
  const texto = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!texto || texto === '-') return VAZIO

  const norm = deaccent(texto)
  const temMinuto = /minuto/.test(norm)
  const temSegundo = /segundo|\bseg\b|\bs\b/.test(norm)

  const numeros = norm.match(/\d+(?:[.,]\d+)?/g)?.map((n) => Number(n.replace(',', '.'))) ?? []

  if (numeros.length === 0) {
    return { restSecondsMin: null, restSecondsMax: null, restNote: texto }
  }

  // "1 minuto e 30 segundos" — minutos e segundos na mesma célula.
  if (temMinuto && temSegundo && numeros.length === 2 && /minuto.*segundo/.test(norm)) {
    const total = numeros[0] * 60 + numeros[1]
    return { restSecondsMin: total, restSecondsMax: total, restNote: null }
  }

  const fator = temMinuto && !temSegundo ? 60 : 1
  const segundos = numeros.map((n) => Math.round(n * fator))

  const min = Math.min(...segundos)
  const max = Math.max(...segundos)

  // Sobrou texto além do número e da unidade? Preserva como nota.
  const resto = norm
    .replace(/\d+(?:[.,]\d+)?/g, '')
    .replace(/minutos?|segundos?|\bseg\b|\bs\b|[-–—e]/g, '')
    .trim()

  return {
    restSecondsMin: min,
    restSecondsMax: max,
    restNote: resto.length > 2 ? texto : null,
  }
}
