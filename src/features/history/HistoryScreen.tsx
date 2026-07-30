import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Id } from '@/db/schema'
import { listSessions } from '@/db/repositories/sessions.repo'
import { listSetLogsOfSession } from '@/db/repositories/setLogs.repo'
import { deletePhoto, listPhotosOfSession } from '@/db/repositories/photos.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { formatDate, formatDateTime, formatDuration } from '@/lib/date'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Splash } from '@/app/Splash'
import { TrainingCalendar } from './TrainingCalendar'

export function HistoryScreen() {
  const profile = useActiveProfile()
  const profileId = profile?.id
  const [expanded, setExpanded] = useState<Id | null>(null)
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  const sessions = useLiveQuery(async () => {
    if (!profileId) return null
    const list = await listSessions(profileId)
    const resumos = await Promise.all(
      list.map(async (session) => {
        const logs = await db.setLogs.where('sessionId').equals(session.id).toArray()
        return {
          setCount: logs.length,
          // Exercícios distintos: é a medida que responde "o que eu treinei".
          exerciseCount: new Set(logs.map((log) => log.exerciseId)).size,
        }
      }),
    )
    return list.map((session, index) => ({ session, ...resumos[index] }))
  }, [profileId])

  const detail = useLiveQuery(async () => {
    if (!expanded) return null
    const [logs, photos] = await Promise.all([
      listSetLogsOfSession(expanded),
      listPhotosOfSession(expanded),
    ])
    return { logs, photos }
  }, [expanded])

  // Um objectURL por foto aberta, revogado ao fechar o card.
  const photoUrls = useMemo(
    () => (detail?.photos ?? []).map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.blob) })),
    [detail],
  )
  useEffect(() => () => photoUrls.forEach(({ url }) => URL.revokeObjectURL(url)), [photoUrls])

  if (!profile || !sessions) return <Splash />

  const visiveis = diaSelecionado
    ? sessions.filter(({ session }) => session.dateKey === diaSelecionado)
    : sessions

  return (
    <Screen
      title="Histórico"
      subtitle={`${sessions.length} treino(s) de ${profile.name}`}
    >
      <TrainingCalendar
        profileId={profile.id}
        selectedDateKey={diaSelecionado}
        onSelectDate={setDiaSelecionado}
      />

      {diaSelecionado ? (
        <p className="mb-3 text-sm text-muted">
          Mostrando {visiveis.length} treino(s) de {formatDate(new Date(`${diaSelecionado}T12:00`).getTime())}
        </p>
      ) : null}

      {visiveis.length === 0 ? (
        <EmptyState
          title={diaSelecionado ? 'Nenhum treino neste dia' : 'Nada registrado ainda'}
          description={
            diaSelecionado
              ? 'Toque no dia de novo para ver o histórico completo.'
              : 'Cada série concluída durante o treino aparece aqui.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {visiveis.map(({ session, setCount, exerciseCount }) => {
            const isOpen = expanded === session.id
            const duration = session.finishedAt ? session.finishedAt - session.startedAt : null
            return (
              <li key={session.id}>
                <Card>
                  <button
                    className="w-full text-left"
                    onClick={() => setExpanded(isOpen ? null : session.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{session.workoutName}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {formatDateTime(session.startedAt)}
                          {session.weekNumber ? ` · semana ${session.weekNumber}` : ''}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">
                          {exerciseCount} exercício(s) · {setCount} série(s)
                          {duration !== null ? ` · ${formatDuration(duration)}` : ' · em andamento'}
                        </p>
                      </div>
                      <span className="text-muted">{isOpen ? '−' : '+'}</span>
                    </div>
                  </button>

                  {isOpen && detail ? (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {photoUrls.length ? (
                        <div className="space-y-2">
                          {photoUrls.map(({ id, url }) => (
                            <div key={id}>
                              <img
                                src={url}
                                alt="Foto do treino"
                                className="w-full rounded-xl object-cover"
                              />
                              <button
                                onClick={() => deletePhoto(id)}
                                className="mt-1 text-xs text-muted underline underline-offset-2 active:text-danger"
                              >
                                remover foto
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="space-y-1">
                        {detail.logs.length === 0 ? (
                          <p className="text-sm text-muted">Nenhuma série registrada.</p>
                        ) : (
                          detail.logs.map((log) => (
                            <div key={log.id} className="flex gap-2 text-sm">
                              <span className="min-w-0 flex-1 truncate text-muted">
                                {log.exerciseName}
                                <span className="text-muted/60"> · s{log.seriesNumber}</span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {log.weight !== null ? `${log.weight} kg` : '—'}
                                {log.reps !== null ? ` × ${log.reps}` : ''}
                                {log.durationSeconds !== null ? ` ${log.durationSeconds}s` : ''}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}
