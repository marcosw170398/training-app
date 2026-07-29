/**
 * Aviso de fim de descanso.
 *
 * O som é sintetizado com Web Audio em vez de um arquivo: não precisa de asset
 * no cache do service worker e toca instantaneamente. Navegadores só liberam
 * áudio depois de um gesto do usuário, então `unlockAudio()` precisa ser
 * chamado no primeiro toque da tela de execução.
 *
 * A Vibration API não existe no Safari/iOS — por isso o som e o aviso visual
 * têm de funcionar sozinhos, com a vibração como bônus.
 */

let audioContext: AudioContext | null = null

type AudioContextCtor = typeof AudioContext

function getContext(): AudioContext | null {
  if (audioContext) return audioContext
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  if (!Ctor) return null
  audioContext = new Ctor()
  return audioContext
}

/** Chamar num gesto do usuário (toque na tela) para destravar o áudio. */
export function unlockAudio(): void {
  const context = getContext()
  if (context && context.state === 'suspended') void context.resume()
}

function beep(context: AudioContext, startAt: number, frequency: number, duration: number): void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // Envelope curto evita o "clique" de corte abrupto.
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

export function playAlarm(options: { sound: boolean; vibration: boolean }): void {
  if (options.sound) {
    const context = getContext()
    if (context) {
      if (context.state === 'suspended') void context.resume()
      const now = context.currentTime
      beep(context, now, 880, 0.16)
      beep(context, now + 0.22, 880, 0.16)
      beep(context, now + 0.44, 1174, 0.28)
    }
  }

  if (options.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([180, 90, 180, 90, 320])
    } catch {
      /* alguns navegadores bloqueiam sem interação recente */
    }
  }
}
