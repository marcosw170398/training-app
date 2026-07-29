import type { SeriesTarget } from '@/db/schema'

/**
 * Segundos para o cronômetro automático, ou `null` quando não há número.
 *
 * Quando a série só traz `restNote` ("um lado após o outro"), NÃO existe
 * cronômetro: a instrução é exibida como texto, conforme o plano prescreve.
 */
export function resolveRestSeconds(
  target: Pick<SeriesTarget, 'restSecondsMin' | 'restSecondsMax'>,
  preferMax: boolean,
): number | null {
  const { restSecondsMin: min, restSecondsMax: max } = target
  if (preferMax) return max ?? min ?? null
  return min ?? max ?? null
}

/** "2–3 min" · "40s" · "um lado após o outro" · "" */
export function restLabel(target: SeriesTarget): string {
  const { restSecondsMin: min, restSecondsMax: max, restNote: note } = target
  if (min === null && max === null) return note ?? ''

  // "40s" · "2m" · "1m30" — compacto o bastante para caber na linha da série.
  const format = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return rest === 0 ? `${minutes}m` : `${minutes}m${String(rest).padStart(2, '0')}`
  }

  let range: string
  if (min !== null && max !== null && min !== max) range = `${format(min)}–${format(max)}`
  else range = format((min ?? max) as number)

  return note ? `${range} · ${note}` : range
}
