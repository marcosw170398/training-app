import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Id, SessionPhoto } from '@/db/schema'
import { listSessionsBetween } from '@/db/repositories/sessions.repo'
import { listPhotosBetween } from '@/db/repositories/photos.repo'
import { daysInMonth, firstWeekdayOfMonth, monthBounds, monthLabel, toDateKey } from '@/lib/date'
import { Card } from '@/components/ui/Card'

const CABECALHO = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

/**
 * Calendário do mês com os dias treinados.
 *
 * Dia com treino fica destacado; dia com foto mostra a própria foto como fundo.
 * É a visão que responde "quantas vezes eu treinei este mês" de relance.
 */
export function TrainingCalendar({
  profileId,
  selectedDateKey,
  onSelectDate,
}: {
  profileId: Id
  selectedDateKey: string | null
  onSelectDate: (dateKey: string | null) => void
}) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())

  const dados = useLiveQuery(async () => {
    const { from, to } = monthBounds(ano, mes)
    const [sessions, photos] = await Promise.all([
      listSessionsBetween(profileId, from, to),
      listPhotosBetween(profileId, from, to),
    ])

    const treinos = new Map<string, number>()
    for (const session of sessions) {
      treinos.set(session.dateKey, (treinos.get(session.dateKey) ?? 0) + 1)
    }

    const fotoPorDia = new Map<string, SessionPhoto>()
    for (const foto of photos) if (!fotoPorDia.has(foto.dateKey)) fotoPorDia.set(foto.dateKey, foto)

    return { treinos, fotoPorDia }
  }, [profileId, ano, mes])

  // Um objectURL por foto exibida; revogados ao trocar de mês.
  const urls = useMemo(() => {
    const mapa = new Map<string, string>()
    if (dados) {
      for (const [dia, foto] of dados.fotoPorDia) mapa.set(dia, URL.createObjectURL(foto.blob))
    }
    return mapa
  }, [dados])

  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls])

  const totalDias = daysInMonth(ano, mes)
  const vazios = firstWeekdayOfMonth(ano, mes) - 1
  const diasTreinados = dados ? dados.treinos.size : 0
  const hojeKey = toDateKey()

  const mudarMes = (delta: number) => {
    const data = new Date(ano, mes + delta, 1)
    setAno(data.getFullYear())
    setMes(data.getMonth())
    onSelectDate(null)
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
          className="flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-2"
        >
          ‹
        </button>
        <div className="text-center">
          {/* `capitalize` do CSS capitalizaria toda palavra ("Julho De 2026"). */}
          <p className="font-semibold first-letter:uppercase">{monthLabel(ano, mes)}</p>
          <p className="text-xs text-muted">
            {diasTreinados} {diasTreinados === 1 ? 'dia treinado' : 'dias treinados'}
          </p>
        </div>
        <button
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
          className="flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-2"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {CABECALHO.map((letra, index) => (
          <span key={index} className="pb-1 text-center text-xs text-muted">
            {letra}
          </span>
        ))}

        {Array.from({ length: vazios }, (_, index) => (
          <span key={`vazio-${index}`} />
        ))}

        {Array.from({ length: totalDias }, (_, index) => {
          const dia = index + 1
          const dateKey = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const treinou = (dados?.treinos.get(dateKey) ?? 0) > 0
          const url = urls.get(dateKey)
          const selecionado = selectedDateKey === dateKey
          const ehHoje = dateKey === hojeKey

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(selecionado ? null : dateKey)}
              aria-label={`Dia ${dia}${treinou ? ', treinou' : ''}`}
              aria-pressed={selecionado}
              className={[
                'relative aspect-square overflow-hidden rounded-lg text-xs',
                selecionado ? 'ring-2 ring-accent' : '',
                treinou && !url ? 'bg-accent/20 font-semibold text-accent' : '',
                !treinou && !url ? 'text-muted active:bg-surface-2' : '',
                ehHoje && !treinou ? 'border border-border' : '',
              ].join(' ')}
            >
              {url ? (
                <>
                  <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-semibold text-white">
                    {dia}
                  </span>
                </>
              ) : (
                <span className="flex size-full items-center justify-center">{dia}</span>
              )}
            </button>
          )
        })}
      </div>

      {selectedDateKey ? (
        <button
          onClick={() => onSelectDate(null)}
          className="mt-3 w-full text-xs text-muted underline underline-offset-2"
        >
          mostrar o histórico completo
        </button>
      ) : null}
    </Card>
  )
}
