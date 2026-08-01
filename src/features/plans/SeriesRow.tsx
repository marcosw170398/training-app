import { useEffect, useState, type FocusEvent } from 'react'
import type { SeriesTarget } from '@/db/schema'
import { deleteSeries, updateSeries } from '@/db/repositories/exercises.repo'

/**
 * Estado local com commit no `blur`: escrever a cada tecla faria o
 * `useLiveQuery` re-renderizar e jogar o cursor para o fim do campo.
 */
export function SeriesRow({ target }: { target: SeriesTarget }) {
  // `addSeries` herda o alvo/descanso da série anterior (economiza digitação
  // — a maioria das séries repete a mesma faixa). Sem selecionar tudo ao
  // focar, digitar por cima só GRUDA no valor herdado em vez de substituí-lo
  // (ex: "8-12" herdado + digitar "8-12" de novo = "8-128-12").
  const selectAll = (event: FocusEvent<HTMLInputElement>) => event.target.select()

  const [text, setText] = useState(target.targetText)
  const [min, setMin] = useState(target.restSecondsMin?.toString() ?? '')
  const [max, setMax] = useState(target.restSecondsMax?.toString() ?? '')
  const [note, setNote] = useState(target.restNote ?? '')

  useEffect(() => {
    setText(target.targetText)
    setMin(target.restSecondsMin?.toString() ?? '')
    setMax(target.restSecondsMax?.toString() ?? '')
    setNote(target.restNote ?? '')
  }, [target.id, target.targetText, target.restSecondsMin, target.restSecondsMax, target.restNote])

  const toNumber = (value: string): number | null => {
    const parsed = Number(value)
    return value.trim() === '' || Number.isNaN(parsed) ? null : parsed
  }

  const commit = () =>
    updateSeries(target.id, {
      targetText: text.trim(),
      restSecondsMin: toNumber(min),
      restSecondsMax: toNumber(max),
      restNote: note.trim() || null,
    })

  const cell =
    'rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-text outline-none focus:border-accent'

  return (
    <div className="rounded-xl border border-border/60 p-2">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-medium text-muted">
          {target.seriesNumber}
        </span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onFocus={selectAll}
          placeholder="Alvo: 8-12, até a falha, 100 reps…"
          className={`${cell} min-w-0 flex-1`}
        />
        {/* min-h/w-11 = 44px: alvo de toque mínimo. O glifo "×" fica pequeno,
            mas está colado a um campo de texto editável — uma área de toque
            apertada aqui é justamente onde um dedo erra e apaga a série
            errada por engano. */}
        <button
          aria-label={`Remover série ${target.seriesNumber}`}
          onClick={() => deleteSeries(target.id)}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-danger active:bg-danger/10"
        >
          ×
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 pl-10">
        {/* Unidade escrita: "min … s" lia como "de minutos a segundos". */}
        <span className="shrink-0 text-xs text-muted">Descanso de</span>
        <input
          value={min}
          onChange={(event) => setMin(event.target.value)}
          onBlur={commit}
          onFocus={selectAll}
          inputMode="numeric"
          placeholder="—"
          aria-label="Descanso mínimo em segundos"
          className={`${cell} w-14 text-center`}
        />
        <span className="text-xs text-muted">a</span>
        <input
          value={max}
          onChange={(event) => setMax(event.target.value)}
          onBlur={commit}
          onFocus={selectAll}
          inputMode="numeric"
          placeholder="—"
          aria-label="Descanso máximo em segundos"
          className={`${cell} w-14 text-center`}
        />
        <span className="shrink-0 text-xs text-muted">segundos</span>
      </div>

      <div className="mt-2 pl-10">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={commit}
          onFocus={selectAll}
          placeholder="Nota de descanso (ex: um lado após o outro)"
          className={`${cell} w-full`}
        />
      </div>
    </div>
  )
}
