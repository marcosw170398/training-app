import { SECTIONS, SECTION_LABEL, type Section } from '@/db/schema'
import type { ParsedExercise } from './parsedPlan'
import { CONFIANCA_BAIXA } from './ocr'

const SECTION_STYLE: Record<Section, string> = {
  warmup: 'bg-warmup/20 text-warmup',
  rampup: 'bg-rampup/20 text-rampup',
  main: 'bg-main/20 text-main',
}

export function ImportExerciseRow({
  exercise,
  onChange,
  onRemove,
}: {
  exercise: ParsedExercise
  onChange: (next: ParsedExercise) => void
  onRemove: () => void
}) {
  const semDescanso =
    exercise.section !== 'warmup' &&
    exercise.series.length > 0 &&
    exercise.series[0].restSecondsMin === null &&
    !exercise.series[0].restNote

  const duvidoso = exercise.confidence < CONFIANCA_BAIXA

  // O PDF traz um intervalo por exercício, não por série — editar aqui aplica
  // a todas as séries dele.
  const aplicarDescanso = (patch: {
    restSecondsMin?: number | null
    restSecondsMax?: number | null
  }) => {
    onChange({
      ...exercise,
      series: exercise.series.map((s) => ({ ...s, ...patch })),
    })
  }

  const paraNumero = (valor: string): number | null => {
    const n = Number(valor)
    return valor.trim() === '' || Number.isNaN(n) ? null : n
  }

  const campo =
    'rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-text outline-none focus:border-accent'

  return (
    <div
      className={[
        'rounded-xl border p-3',
        duvidoso || semDescanso ? 'border-rampup/50 bg-rampup/5' : 'border-border/60',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <input
          value={exercise.name}
          onChange={(event) => onChange({ ...exercise, name: event.target.value })}
          className={`${campo} min-w-0 flex-1 font-medium`}
          aria-label="Nome do exercício"
        />
        <button
          onClick={onRemove}
          aria-label={`Remover ${exercise.name}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-danger active:bg-danger/10"
        >
          ×
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {SECTIONS.map((section) => (
          <button
            key={section}
            onClick={() => onChange({ ...exercise, section })}
            className={[
              'min-h-9 rounded-lg px-2.5 text-xs',
              section === exercise.section
                ? SECTION_STYLE[section]
                : 'bg-surface-2 text-muted',
            ].join(' ')}
          >
            {SECTION_LABEL[section]}
          </button>
        ))}
      </div>

      {exercise.series.length > 0 ? (
        <p className="mt-2 text-sm text-muted">
          {exercise.series.map((s) => s.targetText).join(' · ')}
        </p>
      ) : (
        <p className="mt-2 text-sm text-danger">sem séries reconhecidas</p>
      )}

      {exercise.technique ? (
        <p className="mt-1 text-xs text-muted">técnica: {exercise.technique}</p>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted">Descanso</span>
        <input
          value={exercise.series[0]?.restSecondsMin ?? ''}
          onChange={(event) => aplicarDescanso({ restSecondsMin: paraNumero(event.target.value) })}
          inputMode="numeric"
          placeholder="min"
          className={`${campo} w-16 text-center`}
          aria-label="Descanso mínimo em segundos"
        />
        <span className="text-xs text-muted">a</span>
        <input
          value={exercise.series[0]?.restSecondsMax ?? ''}
          onChange={(event) => aplicarDescanso({ restSecondsMax: paraNumero(event.target.value) })}
          inputMode="numeric"
          placeholder="máx"
          className={`${campo} w-16 text-center`}
          aria-label="Descanso máximo em segundos"
        />
        <span className="shrink-0 text-xs text-muted">s</span>
        {exercise.series[0]?.restNote ? (
          <span className="truncate text-xs text-muted">“{exercise.series[0].restNote}”</span>
        ) : null}
      </div>

      {semDescanso ? (
        <p className="mt-2 text-xs text-rampup">
          O PDF não trouxe intervalo para este exercício — sem número, não há cronômetro.
        </p>
      ) : null}
      {duvidoso ? (
        <p className="mt-1 text-xs text-rampup">
          Leitura por OCR com baixa confiança ({Math.round(exercise.confidence * 100)}%) — confira.
        </p>
      ) : null}
    </div>
  )
}
