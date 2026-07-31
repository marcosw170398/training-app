import { formatClock } from '@/lib/date'
import type { RestTimer } from '@/hooks/useRestTimer'

/**
 * Elemento de assinatura da direção visual: o cronômetro de descanso tratado
 * como um relógio de parede de academia, não como uma barra de progresso
 * genérica. Dígitos grandes em mono tabular (não pulam de largura a cada
 * troca), e marcações a cada 10s na trilha — como as marcas físicas de um
 * cronômetro.
 *
 * É o único lugar do app com essa ousadia visual de propósito: é o momento
 * mais carregado do treino ("minhas pernas já aguentam?"), e o resto da
 * interface fica deliberadamente quieto ao redor disso.
 */
export function RestTimerBar({ timer }: { timer: RestTimer }) {
  if (!timer.running) return null

  const over = timer.remaining <= 0
  const totalSeconds = Math.max(1, Math.round(timer.total))
  const progress = timer.total > 0 ? Math.min(1, Math.max(0, timer.remaining / timer.total)) : 0

  const marcas: number[] = []
  for (let s = 10; s < totalSeconds; s += 10) marcas.push(s)

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/98 px-4 pt-3 backdrop-blur">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">
              {over ? 'Descanso encerrado' : 'Descanso'}
              {timer.label ? ` · ${timer.label}` : ''}
            </p>
            <p
              className={`font-mono text-4xl font-semibold tabular-nums tracking-tight ${
                over ? 'animate-pulse text-accent motion-reduce:animate-none' : 'text-accent'
              }`}
            >
              {over ? `+${formatClock(-timer.remaining)}` : formatClock(timer.remaining)}
            </p>
          </div>
          <button
            onClick={() => timer.add(30)}
            className="min-h-12 rounded-xl border border-border bg-surface-2 px-3 font-mono text-sm tabular-nums active:bg-border"
          >
            +30s
          </button>
          <button
            onClick={timer.stop}
            className="min-h-12 rounded-xl bg-accent px-4 font-semibold text-accent-ink active:bg-accent/80"
          >
            {over ? 'Ok' : 'Pular'}
          </button>
        </div>

        {/* Trilha com marcação a cada 10s — a referência de um cronômetro
            físico, não uma barra de progresso lisa e genérica. */}
        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
          {marcas.map((s) => (
            <span
              key={s}
              aria-hidden
              className="absolute inset-y-0 w-px bg-bg/40"
              style={{ left: `${(s / totalSeconds) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
