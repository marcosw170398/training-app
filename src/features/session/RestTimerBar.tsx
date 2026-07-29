import { formatClock } from '@/lib/date'
import type { RestTimer } from '@/hooks/useRestTimer'

export function RestTimerBar({ timer }: { timer: RestTimer }) {
  if (!timer.running) return null

  const over = timer.remaining <= 0
  const progress = timer.total > 0 ? Math.min(1, Math.max(0, timer.remaining / timer.total)) : 0

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
              className={`text-3xl font-semibold tabular-nums ${over ? 'text-accent' : 'text-text'}`}
            >
              {over ? `+${formatClock(-timer.remaining)}` : formatClock(timer.remaining)}
            </p>
          </div>
          <button
            onClick={() => timer.add(30)}
            className="min-h-12 rounded-xl border border-border bg-surface-2 px-3 text-sm active:bg-border"
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

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
