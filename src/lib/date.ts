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
