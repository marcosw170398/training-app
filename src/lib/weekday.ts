import { NO_WEEKDAY } from '@/db/schema'
import { deaccent } from './text'

/** 1 = segunda ... 7 = domingo. 0 = nenhum dia definido. */
export const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
] as const

export function weekdayLabel(value: number): string {
  return WEEKDAYS.find((w) => w.value === value)?.label ?? 'Sem dia definido'
}

export function weekdayShort(value: number): string {
  return WEEKDAYS.find((w) => w.value === value)?.short ?? '—'
}

/** Dia de hoje no formato interno (1 = segunda ... 7 = domingo). */
export function todayWeekday(now: Date = new Date()): number {
  const js = now.getDay() // 0 = domingo
  return js === 0 ? 7 : js
}

/** Aceita "segunda", "Segunda-feira", "seg" — usado na importação de planos. */
export function parseWeekday(input: string | null | undefined): number {
  if (!input) return NO_WEEKDAY
  const norm = deaccent(input)
  if (!norm) return NO_WEEKDAY
  const found = WEEKDAYS.find((w) => {
    const label = deaccent(w.label)
    const short = deaccent(w.short)
    return label === norm || short === norm || label.startsWith(norm) || norm.startsWith(short)
  })
  return found?.value ?? NO_WEEKDAY
}
