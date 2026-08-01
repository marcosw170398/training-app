import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Id } from '@/db/schema'
import { listSessions, updateSessionNotes } from '@/db/repositories/sessions.repo'
import { listLoggedExercises, listSetLogsOfSession } from '@/db/repositories/setLogs.repo'
import { addSessionPhoto, deletePhoto, listPhotosOfSession } from '@/db/repositories/photos.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { formatDate, formatDateTime, formatDuration, relativeDays } from '@/lib/date'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Chevron } from '@/components/ui/Chevron'
import { Splash } from '@/app/Splash'
import { TrainingCalendar } from './TrainingCalendar'
import { SessionNotesField } from './SessionNotesField'

type Aba = 'sessoes' | 'exercicios'

export function HistoryScreen() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const profileId = profile?.id
  const [aba, setAba] = useState<Aba>('sessoes')
  const [expanded, setExpanded] = useState<Id | null>(null)
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [salvandoFoto, setSalvandoFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState<string | null>(null)

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

  const exercicios = useLiveQuery(
    async () => (profileId && aba === 'exercicios' ? listLoggedExercises(profileId) : null),
    [profileId, aba],
  )

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

  /** Ainda funciona para treino já encerrado — a foto não precisa ser tirada
   * na hora, só fica associada ao dia certo pelo `dateKey` da sessão. */
  const adicionarFoto = async (file: File) => {
    const alvo = sessions.find(({ session }) => session.id === expanded)?.session
    if (!alvo) return
    setSalvandoFoto(true)
    setErroFoto(null)
    try {
      await addSessionPhoto({ profileId: profile.id, sessionId: alvo.id, dateKey: alvo.dateKey, file })
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : 'Não consegui salvar a foto.')
    } finally {
      setSalvandoFoto(false)
    }
  }

  const visiveis = diaSelecionado
    ? sessions.filter(({ session }) => session.dateKey === diaSelecionado)
    : sessions

  return (
    <Screen title="Histórico" subtitle={`${sessions.length} treino(s) de ${profile.name}`}>
      <Card className="mb-4 p-1">
        <div className="flex overflow-hidden rounded-lg">
          {(
            [
              ['sessoes', 'Sessões'],
              ['exercicios', 'Exercícios'],
            ] as [Aba, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setAba(value)}
              aria-pressed={aba === value}
              className={[
                'min-h-11 flex-1 text-sm',
                aba === value ? 'bg-accent/15 font-medium text-accent' : 'text-muted',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {aba === 'exercicios' ? (
        exercicios === undefined || exercicios === null ? (
          <Splash />
        ) : exercicios.length === 0 ? (
          <EmptyState
            title="Nenhum exercício registrado"
            description="Séries marcadas como principal aparecem aqui, com a evolução de carga."
          />
        ) : (
          <ul className="space-y-2">
            {exercicios.map((item) => (
              <li key={item.exerciseKey}>
                <Card
                  onClick={() => navigate(`/historico/ex/${item.exerciseKey}`)}
                  ariaLabel={`${item.name}, ${item.count} série(s), última vez ${relativeDays(item.lastAt)}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-semibold">{item.name}</p>
                      <p className="text-sm text-muted">
                        {item.count} série(s) · última vez {relativeDays(item.lastAt)}
                      </p>
                    </div>
                    <Chevron open={false} className="-rotate-90 text-muted" />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <TrainingCalendar
            profileId={profile.id}
            selectedDateKey={diaSelecionado}
            onSelectDate={setDiaSelecionado}
          />

          {diaSelecionado ? (
            <p className="mb-3 text-sm text-muted">
              Mostrando {visiveis.length} treino(s) de{' '}
              {formatDate(new Date(`${diaSelecionado}T12:00`).getTime())}
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
                            <p className="truncate font-display font-semibold">
                              {session.workoutName}
                            </p>
                            <p className="mt-0.5 text-sm text-muted">
                              {formatDateTime(session.startedAt)}
                              {session.weekNumber ? ` · semana ${session.weekNumber}` : ''}
                            </p>
                            <p className="mt-0.5 text-sm text-muted">
                              {exerciseCount} exercício(s) · {setCount} série(s)
                              {duration !== null ? ` · ${formatDuration(duration)}` : ' · em andamento'}
                            </p>
                          </div>
                          <Chevron open={isOpen} className="text-muted" />
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

                          <div>
                            <input
                              ref={fotoInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void adicionarFoto(file)
                                event.target.value = ''
                              }}
                            />
                            <Button
                              size="sm"
                              disabled={salvandoFoto}
                              onClick={() => fotoInputRef.current?.click()}
                            >
                              {salvandoFoto
                                ? 'Salvando…'
                                : photoUrls.length
                                  ? '+ Adicionar outra foto'
                                  : '+ Adicionar foto'}
                            </Button>
                            {erroFoto ? <p className="mt-1 text-sm text-danger">{erroFoto}</p> : null}
                          </div>

                          <SessionNotesField
                            sessionId={session.id}
                            initialValue={session.notes}
                            onSave={(notes) => updateSessionNotes(session.id, notes)}
                          />

                          <div className="space-y-1">
                            {detail.logs.length === 0 ? (
                              <p className="text-sm text-muted">Nenhuma série registrada.</p>
                            ) : (
                              detail.logs.map((log) => (
                                <div key={log.id} className="flex gap-2 text-sm">
                                  <span className="min-w-0 flex-1 truncate text-muted">
                                    {log.exerciseName}
                                    {/* muted/60 media 2,57:1 de contraste sobre o
                                        fundo do card — abaixo do mínimo de leitura
                                        (4.5:1). muted puro já é a cor discreta. */}
                                    <span className="text-muted"> · s{log.seriesNumber}</span>
                                  </span>
                                  <span className="shrink-0 font-mono tabular-nums">
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
        </>
      )}
    </Screen>
  )
}
