import { useCallback, useEffect, useRef, useState } from 'react'
import { playAlarm } from '@/lib/alarm'

export interface RestTimer {
  running: boolean
  /** Segundos restantes. Negativo = descanso estourado (contagem para cima). */
  remaining: number
  total: number
  label: string | null
  start: (seconds: number, label?: string) => void
  add: (seconds: number) => void
  stop: () => void
}

/**
 * Cronômetro de descanso.
 *
 * Guarda o INSTANTE de término (`endsAt`) e deriva o restante a cada tick, em
 * vez de decrementar um contador: Android e iOS estrangulam `setInterval` com a
 * tela apagada, e um contador decrementado atrasaria minutos ao longo do treino.
 * Com timestamp absoluto, voltar para o app mostra o tempo correto.
 */
export function useRestTimer(prefs: { sound: boolean; vibration: boolean }): RestTimer {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [label, setLabel] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const alarmFired = useRef(false)

  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  const remaining = endsAt === null ? 0 : Math.round((endsAt - now) / 1000)

  useEffect(() => {
    if (endsAt === null || alarmFired.current) return
    if (remaining > 0) return
    alarmFired.current = true
    playAlarm({ sound: prefsRef.current.sound, vibration: prefsRef.current.vibration })
  }, [endsAt, remaining])

  const start = useCallback((seconds: number, nextLabel?: string) => {
    alarmFired.current = false
    setTotal(seconds)
    setLabel(nextLabel ?? null)
    setNow(Date.now())
    setEndsAt(Date.now() + seconds * 1000)
  }, [])

  const add = useCallback((seconds: number) => {
    setEndsAt((current) => {
      if (current === null) return current
      const next = current + seconds * 1000
      if (next > Date.now()) alarmFired.current = false
      return next
    })
    setTotal((current) => Math.max(0, current + seconds))
  }, [])

  const stop = useCallback(() => {
    setEndsAt(null)
    setLabel(null)
    setTotal(0)
    alarmFired.current = false
  }, [])

  return { running: endsAt !== null, remaining, total, label, start, add, stop }
}
