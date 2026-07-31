import { useEffect, useState } from 'react'
import type { SetLog } from '@/db/schema'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { formatDate } from '@/lib/date'
import type { SetDraft } from './setDraft'

/**
 * Linha de série CONTROLADA: o rascunho vive na tela de execução, não aqui.
 *
 * É o que permite o botão "concluir todas" do exercício usar exatamente os
 * valores que o usuário digitou em cada série, em vez de recalcular padrões e
 * descartar as edições dele.
 */
export function SetRow({
  seriesNumber,
  targetText,
  restText,
  log,
  isPR,
  prefill,
  isExtra,
  draft,
  defaultDraft,
  onDraftChange,
  onComplete,
  onEdit,
  onUndo,
}: {
  seriesNumber: number
  targetText: string
  restText: string
  /** Já registrado nesta sessão. */
  log?: SetLog
  /** A carga registrada bateu o recorde do movimento no momento em que foi feita. */
  isPR?: boolean
  /** Última execução deste movimento/série — origem da carga sugerida. */
  prefill?: SetLog
  isExtra: boolean
  draft: SetDraft | undefined
  defaultDraft: SetDraft
  onDraftChange: (next: SetDraft) => void
  onComplete: () => void
  /** Corrige um número já registrado, sem apagar e refazer a série. */
  onEdit: (values: { weight: number | null; reps: number | null }) => void
  onUndo: () => void
}) {
  const atual = draft ?? defaultDraft
  const [editando, setEditando] = useState(false)
  const [pesoEdit, setPesoEdit] = useState('')
  const [repsEdit, setRepsEdit] = useState('')

  // Semeia o rascunho na primeira renderização da linha, para que a tela de
  // execução conheça os valores sugeridos mesmo sem o usuário tocar no campo.
  useEffect(() => {
    if (!draft && !log) onDraftChange(defaultDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, log])

  const alterar = (patch: Partial<SetDraft>) => onDraftChange({ ...atual, ...patch })

  const abrirEdicao = () => {
    setPesoEdit(log?.weight != null ? String(log.weight) : '')
    setRepsEdit(log?.reps != null ? String(log.reps) : '')
    setEditando(true)
  }

  const toNumero = (valor: string): number | null => {
    const n = Number(valor.replace(',', '.'))
    return valor.trim() === '' || Number.isNaN(n) ? null : n
  }

  const salvarEdicao = () => {
    onEdit({ weight: toNumero(pesoEdit), reps: toNumero(repsEdit) })
    setEditando(false)
  }

  if (log && editando) {
    return (
      <div className="rounded-xl border border-accent/40 bg-surface-2/40 p-3">
        <p className="mb-2 text-sm text-muted">
          Editando série {seriesNumber}
          {isExtra ? ' (extra)' : ''} · {log.targetText || '—'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper label="Carga (kg)" value={pesoEdit} onChange={setPesoEdit} step={2.5} placeholder="—" />
          <NumberStepper label="Repetições" value={repsEdit} onChange={setRepsEdit} step={1} placeholder="—" />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setEditando(false)}
            className="min-h-11 flex-1 rounded-lg border border-border text-sm text-muted"
          >
            Cancelar
          </button>
          <button
            onClick={salvarEdicao}
            className="min-h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-accent-ink"
          >
            Salvar
          </button>
        </div>
      </div>
    )
  }

  if (log) {
    return (
      <div
        className={[
          'flex items-center gap-3 rounded-xl border px-3 py-3',
          isPR ? 'border-main/50 bg-main/10' : 'border-main/30 bg-main/5',
        ].join(' ')}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-main/15 text-sm font-semibold text-main">
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            Série {seriesNumber}
            {isExtra ? ' (extra)' : ''} · {log.targetText || '—'}
          </p>
          <p className="font-mono font-semibold tabular-nums">
            {log.weight !== null ? `${log.weight} kg` : 'sem carga'}
            {log.reps !== null ? ` × ${log.reps}` : ''}
            {log.durationSeconds !== null ? ` · ${log.durationSeconds}s` : ''}
            {isPR ? <span className="ml-2 font-sans text-xs font-medium text-main">🏆 recorde</span> : null}
          </p>
        </div>
        <button onClick={abrirEdicao} className="shrink-0 px-2 py-2 text-sm text-muted active:text-accent">
          editar
        </button>
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
            <span className="font-mono tabular-nums text-text">
              {prefill.weight !== null ? `${prefill.weight} kg` : '—'}
              {prefill.reps !== null ? ` × ${prefill.reps}` : ''}
            </span>
            <br />
            {formatDate(prefill.performedAt)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <NumberStepper
          label="Carga (kg)"
          value={atual.weight}
          onChange={(weight) => alterar({ weight })}
          step={2.5}
          placeholder="—"
        />
        <NumberStepper
          label="Repetições"
          value={atual.reps}
          onChange={(reps) => alterar({ reps })}
          step={1}
          placeholder="—"
        />
        <button
          aria-label={`Concluir série ${seriesNumber}`}
          onClick={onComplete}
          className="flex min-h-12 w-14 items-center justify-center rounded-xl bg-accent text-xl font-bold text-accent-ink active:bg-accent/80"
        >
          ✓
        </button>
      </div>

      {atual.showDuration ? (
        <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
          <NumberStepper
            label="Tempo (segundos)"
            value={atual.duration}
            onChange={(duration) => alterar({ duration })}
            step={5}
            placeholder="—"
          />
          <button
            onClick={() => alterar({ showDuration: false })}
            className="min-h-12 rounded-xl border border-border px-3 text-sm text-muted"
          >
            remover
          </button>
        </div>
      ) : (
        <button
          onClick={() => alterar({ showDuration: true })}
          className="mt-2 text-xs text-muted underline underline-offset-2"
        >
          registrar tempo (isometria, cardio)
        </button>
      )}
    </div>
  )
}
