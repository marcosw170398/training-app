import { useEffect } from 'react'

/**
 * Mantém a tela acesa durante o treino. Sem isso o celular apaga no meio do
 * descanso e o usuário perde o cronômetro de vista.
 *
 * Não é suportado em todo lugar (Safari só a partir do 16.4) — falha em
 * silêncio de propósito: é conforto, não requisito.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        /* negado ou indisponível */
      }
    }

    // Voltar de segundo plano libera o lock: é preciso pedir de novo.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [enabled])
}
