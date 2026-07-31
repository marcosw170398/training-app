import { useEffect, useState } from 'react'
import type { Id } from '@/db/schema'

/**
 * Campo de nota da sessão ("senti dor no ombro", "treino puxado hoje").
 *
 * Estado local com commit no `blur` — gravar a cada tecla faria o
 * `useLiveQuery` recarregar a sessão e jogar o cursor para o fim do campo,
 * mesmo problema já resolvido em `SeriesRow.tsx`. Começa recolhido quando
 * vazio: a maioria dos treinos não tem nota, e o campo não deve competir por
 * atenção com as séries.
 */
export function SessionNotesField({
  sessionId,
  initialValue,
  onSave,
}: {
  sessionId: Id
  initialValue: string | null
  onSave: (notes: string | null) => void
}) {
  const [aberto, setAberto] = useState(Boolean(initialValue))
  const [texto, setTexto] = useState(initialValue ?? '')

  useEffect(() => {
    setTexto(initialValue ?? '')
    setAberto((atual) => atual || Boolean(initialValue))
  }, [sessionId, initialValue])

  const commit = () => onSave(texto.trim() || null)

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="text-sm text-muted underline underline-offset-2"
      >
        + Adicionar nota
      </button>
    )
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">Nota</span>
      <textarea
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onBlur={commit}
        placeholder="Ex.: senti dor no ombro, treino puxado hoje…"
        rows={2}
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
    </label>
  )
}
