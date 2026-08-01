/** "YYYY-MM-DD" no fuso local (não UTC — o dia do treino é o dia do usuário). */
export function toDateKey(ts: number = Date.now()): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR')
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Dias inteiros decorridos entre `ts` e agora (0 = hoje). */
export function daysSince(ts: number, now: number = Date.now()): number {
  const a = new Date(ts)
  const b = new Date(now)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** "hoje" | "ontem" | "há 18 dias" */
export function relativeDays(ts: number, now: number = Date.now()): string {
  const d = daysSince(ts, now)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  return `há ${d} dias`
}

/** Primeiro e último dia do mês, no formato de `dateKey`. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const ultimoDia = new Date(year, month + 1, 0).getDate()
  const mm = String(month + 1).padStart(2, '0')
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(ultimoDia).padStart(2, '0')}` }
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/** Quantos dias tem o mês. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Dia da semana do 1º do mês, na convenção do app (1 = segunda ... 7 = domingo). */
export function firstWeekdayOfMonth(year: number, month: number): number {
  const js = new Date(year, month, 1).getDay()
  return js === 0 ? 7 : js
}

/** Segunda-feira da semana que contém `dateKey`, no mesmo formato `dateKey`. */
export function mondayOfWeek(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const js = d.getDay()
  const deltaParaSegunda = js === 0 ? -6 : 1 - js
  d.setDate(d.getDate() + deltaParaSegunda)
  return toDateKey(d.getTime())
}

/** Duração em segundos -> "1:05" ou "12:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** Duração em ms -> "1h 12min" | "48min". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
