import { SECTIONS, SECTION_LABEL, type Section } from '@/db/schema'
import type { ParsedExercise, ParsedSeries } from './parsedPlan'
import { CONFIANCA_BAIXA } from './ocr'

const SECTION_STYLE: Record<Section, string> = {
  warmup: 'bg-warmup/20 text-warmup',
  rampup: 'bg-rampup/20 text-rampup',
  main: 'bg-main/20 text-main',
}

const CAMPO =
  'rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-text outline-none focus:border-accent'

export function ImportExerciseRow({
  exercise,
  onChange,
  onRemove,
  onMove,
}: {
  exercise: ParsedExercise
  onChange: (next: ParsedExercise) => void
  onRemove: () => void
  /** Ausente quando não há outro treino para onde mover. */
  onMove?: () => void
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
    onChange({ ...exercise, series: exercise.series.map((s) => ({ ...s, ...patch })) })
  }

  const paraNumero = (valor: string): number | null => {
    const n = Number(valor)
    return valor.trim() === '' || Number.isNaN(n) ? null : n
  }

  const alterarSerie = (indice: number, targetText: string) => {
    onChange({
      ...exercise,
      series: exercise.series.map((s, i) => (i === indice ? { ...s, targetText } : s)),
    })
  }

  const removerSerie = (indice: number) => {
    onChange({
      ...exercise,
      series: exercise.series
        .filter((_, i) => i !== indice)
        .map((s, i) => ({ ...s, seriesNumber: i + 1 })),
    })
  }

  const adicionarSerie = () => {
    const ultima = exercise.series.at(-1)
    const nova: ParsedSeries = {
      seriesNumber: exercise.series.length + 1,
      targetText: ultima?.targetText ?? '',
      restSecondsMin: ultima?.restSecondsMin ?? null,
      restSecondsMax: ultima?.restSecondsMax ?? null,
      restNote: ultima?.restNote ?? null,
    }
    onChange({ ...exercise, series: [...exercise.series, nova] })
  }

  return (
    <div
      className={[
        'rounded-xl border p-3',
        duvidoso || semDescanso || exercise.series.length === 0
          ? 'border-rampup/50 bg-rampup/5'
          : 'border-border/60',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <input
          value={exercise.name}
          onChange={(event) => onChange({ ...exercise, name: event.target.value })}
          className={`${CAMPO} min-w-0 flex-1 font-medium`}
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

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {SECTIONS.map((section) => (
          <button
            key={section}
            onClick={() => onChange({ ...exercise, section })}
            className={[
              'min-h-9 rounded-lg px-2.5 text-xs',
              section === exercise.section ? SECTION_STYLE[section] : 'bg-surface-2 text-muted',
            ].join(' ')}
          >
            {SECTION_LABEL[section]}
          </button>
        ))}
        {onMove ? (
          <button
            onClick={onMove}
            className="ml-auto min-h-9 rounded-lg border border-border px-2.5 text-xs text-muted active:bg-surface-2"
          >
            Mover para…
          </button>
        ) : null}
      </div>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs text-muted">Técnica / observação</span>
        <input
          value={exercise.technique ?? ''}
          onChange={(event) => {
            // NÃO usar trim() aqui: a cada tecla ele apagaria o espaço que o
            // usuário acabou de digitar, e a próxima letra colaria na palavra
            // anterior. A limpeza acontece na gravação (saveParsedPlan).
            const valor = event.target.value
            onChange({ ...exercise, technique: valor.trim() === '' ? null : valor })
          }}
          placeholder="Ex: progressão de carga e drop"
          className={`${CAMPO} w-full`}
        />
      </label>

      <div className="mt-2">
        <span className="mb-1 block text-xs text-muted">Séries (alvo de cada uma)</span>
        {exercise.series.length === 0 ? (
          <p className="mb-2 text-sm text-danger">
            Nenhuma série reconhecida — adicione as séries deste exercício.
          </p>
        ) : null}
        <div className="space-y-1.5">
          {exercise.series.map((serie, indice) => (
            <div key={indice} className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs text-muted">
                {indice + 1}
              </span>
              <input
                value={serie.targetText}
                onChange={(event) => alterarSerie(indice, event.target.value)}
                placeholder="Ex: 8-12, até a falha, 100 reps"
                className={`${CAMPO} min-w-0 flex-1`}
                aria-label={`Alvo da série ${indice + 1}`}
              />
              {/* min-h/w-11 = 44px: alvo mínimo de toque, colado a um campo de
                  texto editável — apertado aqui é onde se apaga série à toa. */}
              <button
                onClick={() => removerSerie(indice)}
                aria-label={`Remover série ${indice + 1}`}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-danger active:bg-danger/10"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={adicionarSerie}
          className="mt-1.5 min-h-9 rounded-lg border border-border px-2.5 text-xs text-muted active:bg-surface-2"
        >
          + série
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {/* "min" lia como minutos e o "s" final como segundos, dando "de min a
            s". Os alvos são sempre em segundos, então a unidade vem escrita e
            os campos usam "de"/"até". */}
        <span className="shrink-0 text-xs text-muted">Descanso de</span>
        <input
          value={exercise.series[0]?.restSecondsMin ?? ''}
          onChange={(event) => aplicarDescanso({ restSecondsMin: paraNumero(event.target.value) })}
          inputMode="numeric"
          placeholder="—"
          className={`${CAMPO} w-14 text-center`}
          aria-label="Descanso mínimo em segundos"
        />
        <span className="text-xs text-muted">a</span>
        <input
          value={exercise.series[0]?.restSecondsMax ?? ''}
          onChange={(event) => aplicarDescanso({ restSecondsMax: paraNumero(event.target.value) })}
          inputMode="numeric"
          placeholder="—"
          className={`${CAMPO} w-14 text-center`}
          aria-label="Descanso máximo em segundos"
        />
        <span className="shrink-0 text-xs text-muted">segundos</span>
        {exercise.series[0]?.restNote ? (
          <span className="truncate text-xs text-muted">“{exercise.series[0].restNote}”</span>
        ) : null}
      </div>

      {exercise.originalName ? (
        <p className="mt-2 text-xs text-muted">
          corrigido pelo dicionário · o PDF foi lido como “{exercise.originalName}”
        </p>
      ) : null}
      {semDescanso ? (
        <p className="mt-1 text-xs text-rampup">
          O PDF não trouxe intervalo — sem número, não há cronômetro.
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
