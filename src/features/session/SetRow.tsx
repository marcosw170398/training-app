import { useEffect, useState } from 'react'
import type { SetLog } from '@/db/schema'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { formatDate } from '@/lib/date'

export interface SetValues {
  weight: number | null
  reps: number | null
  durationSeconds: number | null
}

const toNumber = (value: string): number | null => {
  const parsed = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(parsed) ? null : parsed
}

export function SetRow({
  seriesNumber,
  targetText,
  restText,
  log,
  prefill,
  isExtra,
  onComplete,
  onUndo,
}: {
  seriesNumber: number
  targetText: string
  restText: string
  /** Já registrado nesta sessão. */
  log?: SetLog
  /** Última execução deste movimento/série — a origem do pré-preenchimento. */
  prefill?: SetLog
  isExtra: boolean
  onComplete: (values: SetValues) => void
  onUndo: () => void
}) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [duration, setDuration] = useState('')
  const [showDuration, setShowDuration] = useState(false)

  // A carga começa na última usada — editável, nunca imposta.
  useEffect(() => {
    if (log) return
    setWeight(prefill?.weight !== null && prefill?.weight !== undefined ? String(prefill.weight) : '')
    setReps(prefill?.reps !== null && prefill?.reps !== undefined ? String(prefill.reps) : '')
    setDuration(
      prefill?.durationSeconds !== null && prefill?.durationSeconds !== undefined
        ? String(prefill.durationSeconds)
        : '',
    )
    setShowDuration(prefill?.durationSeconds != null)
  }, [prefill?.id, log?.id, log, prefill])

  if (log) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-main/30 bg-main/5 px-3 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-main/15 text-sm font-semibold text-main">
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            Série {seriesNumber}
            {isExtra ? ' (extra)' : ''} · {log.targetText || '—'}
          </p>
          <p className="font-semibold tabular-nums">
            {log.weight !== null ? `${log.weight} kg` : 'sem carga'}
            {log.reps !== null ? ` × ${log.reps}` : ''}
            {log.durationSeconds !== null ? ` · ${log.durationSeconds}s` : ''}
          </p>
        </div>
        <button onClick={onUndo} className="shrink-0 px-2 py-2 text-sm text-muted active:text-danger">
          desfazer
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="mb-2 flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-medium text-muted">
          {seriesNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {targetText || 'sem alvo definido'}
            {isExtra ? <span className="text-muted"> · extra</span> : null}
          </p>
          {restText ? <p className="text-xs text-muted">descanso {restText}</p> : null}
        </div>
        {prefill ? (
          <p className="shrink-0 text-right text-xs text-muted">
            última
            <br />
            <span className="tabular-nums text-text">
              {prefill.weight !== null ? `${prefill.weight} kg` : '—'}
              {prefill.reps !== null ? ` × ${prefill.reps}` : ''}
            </span>
            <br />
            {formatDate(prefill.performedAt)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <NumberStepper
          aria-label="Carga em kg"
          value={weight}
          onChange={setWeight}
          step={2.5}
          suffix="kg"
          placeholder="—"
        />
        <NumberStepper
          aria-label="Repetições"
          value={reps}
          onChange={setReps}
          step={1}
          suffix="reps"
          placeholder="—"
        />
        <button
          aria-label={`Concluir série ${seriesNumber}`}
          onClick={() =>
            onComplete({
              weight: toNumber(weight),
              reps: toNumber(reps),
              durationSeconds: showDuration ? toNumber(duration) : null,
            })
          }
          className="flex min-h-12 w-14 items-center justify-center rounded-xl bg-accent text-xl font-bold text-accent-ink active:bg-accent/80"
        >
          ✓
        </button>
      </div>

      {showDuration ? (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <NumberStepper
            aria-label="Duração em segundos"
            value={duration}
            onChange={setDuration}
            step={5}
            suffix="s"
            placeholder="tempo"
          />
          <button
            onClick={() => setShowDuration(false)}
            className="min-h-12 rounded-xl border border-border px-3 text-sm text-muted"
          >
            remover
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowDuration(true)}
          className="mt-2 text-xs text-muted underline underline-offset-2"
        >
          registrar tempo (isometria, cardio)
        </button>
      )}
    </div>
  )
}
