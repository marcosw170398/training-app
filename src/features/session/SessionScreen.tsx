import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  IN_PROGRESS,
  type Exercise,
  type GroupMode,
  type Id,
  type SeriesTarget,
  type SetLog,
} from '@/db/schema'
import { getProfileState } from '@/db/repositories/profiles.repo'
import { listExercises, listSeriesOfWorkout } from '@/db/repositories/exercises.repo'
import {
  finishSession,
  getSession,
  setGroupMode,
  toggleWarmupDone,
} from '@/db/repositories/sessions.repo'
import {
  deleteSetLog,
  lastSetsForExercise,
  listSetLogsOfSession,
  logSet,
} from '@/db/repositories/setLogs.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { useRestTimer } from '@/hooks/useRestTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { unlockAudio } from '@/lib/alarm'
import { resolveRestSeconds, restLabel } from '@/lib/rest'
import { formatDuration } from '@/lib/date'
import { repsFromTarget } from '@/lib/targetReps'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionBadge } from '@/components/ui/SectionBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Splash } from '@/app/Splash'
import { RestTimerBar } from './RestTimerBar'
import { SetRow } from './SetRow'
import { draftToValues, type SetDraft } from './setDraft'
import { SessionPhotoSheet } from './SessionPhotoSheet'

interface Block {
  key: string
  group: string | null
  exercises: Exercise[]
}

interface Row {
  seriesNumber: number
  target: SeriesTarget | null
  isExtra: boolean
}

const logKey = (exerciseId: Id, seriesNumber: number) => `${exerciseId}|${seriesNumber}`

export function SessionScreen() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const profileId = profile?.id

  const [pendingExtras, setPendingExtras] = useState<Record<Id, number>>({})
  /** Rascunho de cada série pendente, por `exerciseId|seriesNumber`. */
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({})
  /** Exercícios recolhidos, por chave de bloco. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  /** Blocos já recolhidos automaticamente — evita recolher de novo se reabrir. */
  const autoCollapsed = useRef<Set<string>>(new Set())
  const [photoOpen, setPhotoOpen] = useState(false)
  const [warmupOpen, setWarmupOpen] = useState(true)
  const [finishOpen, setFinishOpen] = useState(false)

  const data = useLiveQuery(async () => {
    if (!profileId) return null
    const session = await getSession(sessionId)
    if (!session) return null

    const [state, exercises, seriesByExercise, logs] = await Promise.all([
      getProfileState(profileId),
      listExercises(session.workoutId),
      listSeriesOfWorkout(session.workoutId),
      listSetLogsOfSession(sessionId),
    ])

    const prefills = new Map<Id, Map<number, SetLog>>()
    for (const exercise of exercises) {
      if (exercise.section === 'warmup') continue
      const series = seriesByExercise.get(exercise.id) ?? []
      prefills.set(
        exercise.id,
        await lastSetsForExercise(
          profileId,
          exercise.exerciseKey,
          exercise.section,
          series.map((target) => target.seriesNumber),
        ),
      )
    }

    return { session, state, exercises, seriesByExercise, logs, prefills }
  }, [sessionId, profileId])

  const prefs = {
    sound: data?.state.soundEnabled ?? true,
    vibration: data?.state.vibrationEnabled ?? true,
  }
  const timer = useRestTimer(prefs)
  useWakeLock(Boolean(data?.state.keepScreenAwake) && data?.session.finishedAt === IN_PROGRESS)

  if (!profile || data === undefined) return <Splash />
  if (data === null) {
    return (
      <Screen title="Treino" back="/home">
        <EmptyState title="Sessão não encontrada" />
      </Screen>
    )
  }

  const { session, state, exercises, seriesByExercise, logs, prefills } = data

  const logsByKey = new Map<string, SetLog>()
  for (const log of logs) logsByKey.set(logKey(log.exerciseId, log.seriesNumber), log)

  const warmups = exercises.filter((exercise) => exercise.section === 'warmup')
  const mainExercises = exercises.filter((exercise) => exercise.section !== 'warmup')

  // Exercícios que compartilham `supersetGroup` viram um bloco único.
  const blocks: Block[] = []
  const consumed = new Set<Id>()
  for (const exercise of mainExercises) {
    if (consumed.has(exercise.id)) continue
    if (exercise.supersetGroup) {
      const members = mainExercises.filter((item) => item.supersetGroup === exercise.supersetGroup)
      for (const member of members) consumed.add(member.id)
      blocks.push({ key: `g:${exercise.supersetGroup}`, group: exercise.supersetGroup, exercises: members })
    } else {
      consumed.add(exercise.id)
      blocks.push({ key: exercise.id, group: null, exercises: [exercise] })
    }
  }

  const rowsFor = (exercise: Exercise): Row[] => {
    const series = seriesByExercise.get(exercise.id) ?? []
    const loggedNumbers = logs
      .filter((log) => log.exerciseId === exercise.id)
      .map((log) => log.seriesNumber)
    const maxLogged = loggedNumbers.length ? Math.max(...loggedNumbers) : 0
    const extras = Math.max(
      Math.max(0, maxLogged - series.length),
      pendingExtras[exercise.id] ?? 0,
    )

    return [
      ...series.map((target) => ({
        seriesNumber: target.seriesNumber,
        target,
        isExtra: false,
      })),
      ...Array.from({ length: extras }, (_, index) => ({
        seriesNumber: series.length + index + 1,
        target: null,
        isExtra: true,
      })),
    ]
  }

  const addExtra = (targets: Exercise[]) => {
    setPendingExtras((current) => {
      const next = { ...current }
      for (const exercise of targets) {
        const series = seriesByExercise.get(exercise.id) ?? []
        const loggedNumbers = logs
          .filter((log) => log.exerciseId === exercise.id)
          .map((log) => log.seriesNumber)
        const maxLogged = loggedNumbers.length ? Math.max(...loggedNumbers) : 0
        const loggedExtras = Math.max(0, maxLogged - series.length)
        next[exercise.id] = Math.max(loggedExtras, current[exercise.id] ?? 0) + 1
      }
      return next
    })
  }

  const startRest = (exercise: Exercise, row: Row) => {
    const series = seriesByExercise.get(exercise.id) ?? []
    // Série extra herda o descanso da última série prescrita.
    const target = row.target ?? series.at(-1) ?? null
    if (!target) return
    const seconds = resolveRestSeconds(target, state.restDefaultsToMax)
    // Só `restNote` (ex: "um lado após o outro") não dispara cronômetro —
    // a instrução já está visível na linha da série.
    if (seconds === null) return
    timer.start(seconds, exercise.name)
  }

  /**
   * Valores sugeridos de uma série pendente.
   *
   * A carga vem da última vez que este movimento foi feito; as repetições, do
   * TOPO da faixa prescrita — é a meta da série. Quando o alvo não descreve
   * repetições ("até a falha", "5 minutos"), cai para o que foi feito da última
   * vez em vez de chutar.
   */
  const defaultDraftFor = (exercise: Exercise, row: Row): SetDraft => {
    const prefill = prefills.get(exercise.id)?.get(row.seriesNumber)
    const doAlvo = repsFromTarget(row.target?.targetText)
    const daUltimaVez = prefill?.reps ?? null

    return {
      weight: prefill?.weight != null ? String(prefill.weight) : '',
      reps: doAlvo != null ? String(doAlvo) : daUltimaVez != null ? String(daUltimaVez) : '',
      duration: prefill?.durationSeconds != null ? String(prefill.durationSeconds) : '',
      showDuration: prefill?.durationSeconds != null,
    }
  }

  const draftFor = (exercise: Exercise, row: Row): SetDraft =>
    drafts[logKey(exercise.id, row.seriesNumber)] ?? defaultDraftFor(exercise, row)

  const gravar = (exercise: Exercise, row: Row) =>
    logSet({
      profileId: profile.id,
      sessionId: session.id,
      exercise,
      seriesTarget: row.target,
      seriesNumber: row.seriesNumber,
      targetText: row.target?.targetText ?? '',
      ...draftToValues(draftFor(exercise, row)),
    })

  const pendentesDoBloco = (block: Block): number =>
    block.exercises.reduce(
      (total, exercise) =>
        total +
        rowsFor(exercise).filter((row) => !logsByKey.has(logKey(exercise.id, row.seriesNumber)))
          .length,
      0,
    )

  /** Recolhe o bloco assim que ele fica completo — menos rolagem na academia. */
  const recolherSeCompletou = (block: Block, pendentesAntes: number, gravadas: number) => {
    if (pendentesAntes - gravadas > 0) return
    if (autoCollapsed.current.has(block.key)) return
    autoCollapsed.current.add(block.key)
    setCollapsed((atual) => new Set(atual).add(block.key))
  }

  const complete = async (block: Block, exercise: Exercise, row: Row, withRest: boolean) => {
    const pendentesAntes = pendentesDoBloco(block)
    await gravar(exercise, row)
    if (withRest) startRest(exercise, row)
    recolherSeCompletou(block, pendentesAntes, 1)
  }

  /**
   * Marca todas as séries pendentes do exercício de uma vez.
   *
   * Usa o rascunho de CADA linha, então as edições que o usuário fez campo a
   * campo são preservadas. Não dispara cronômetro: registrar em lote é um
   * lançamento retroativo, não a conclusão de uma série agora.
   */
  const completeAll = async (block: Block, exercise: Exercise) => {
    const pendentesAntes = pendentesDoBloco(block)
    const pendentes = rowsFor(exercise).filter(
      (row) => !logsByKey.has(logKey(exercise.id, row.seriesNumber)),
    )
    for (const row of pendentes) await gravar(exercise, row)
    recolherSeCompletou(block, pendentesAntes, pendentes.length)
  }

  const renderExerciseRows = (block: Block, exercise: Exercise, withRest = true) => (
    <div className="space-y-2">
      {rowsFor(exercise).map((row) => {
        const chave = logKey(exercise.id, row.seriesNumber)
        const log = logsByKey.get(chave)
        return (
          <SetRow
            key={`${exercise.id}-${row.seriesNumber}`}
            seriesNumber={row.seriesNumber}
            targetText={row.target?.targetText ?? ''}
            restText={row.target ? restLabel(row.target) : ''}
            log={log}
            prefill={prefills.get(exercise.id)?.get(row.seriesNumber)}
            isExtra={row.isExtra}
            draft={drafts[chave]}
            defaultDraft={defaultDraftFor(exercise, row)}
            onDraftChange={(next) => setDrafts((atual) => ({ ...atual, [chave]: next }))}
            onComplete={() => complete(block, exercise, row, withRest)}
            onUndo={() => log && deleteSetLog(log.id)}
          />
        )
      })}
    </div>
  )

  const doneCount = logs.length
  const isOpen = session.finishedAt === IN_PROGRESS

  return (
    <div onPointerDown={unlockAudio}>
      <Screen
        title={session.workoutName}
        subtitle={
          <>
            {session.weekNumber ? `Semana ${String(session.weekNumber).padStart(2, '0')} · ` : ''}
            <Elapsed startedAt={session.startedAt} running={isOpen} />
            {` · ${doneCount} série(s)`}
          </>
        }
        back="/home"
        action={
          isOpen ? (
            <Button size="sm" onClick={() => setFinishOpen(true)}>
              Encerrar
            </Button>
          ) : null
        }
      >
        {warmups.length > 0 ? (
          <Card className="mb-4">
            <button
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setWarmupOpen((open) => !open)}
            >
              <SectionBadge section="warmup" />
              <span className="min-w-0 flex-1 text-sm text-muted">
                {session.warmupDone.length}/{warmups.length} feitos
              </span>
              <span className="text-muted">{warmupOpen ? '−' : '+'}</span>
            </button>

            {warmupOpen ? (
              <ul className="mt-3 space-y-2">
                {warmups.map((exercise) => {
                  const done = session.warmupDone.includes(exercise.id)
                  const series = seriesByExercise.get(exercise.id) ?? []
                  return (
                    <li key={exercise.id}>
                      <button
                        onClick={() => toggleWarmupDone(session.id, exercise.id)}
                        className={[
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left',
                          done ? 'border-warmup/40 bg-warmup/10' : 'border-border bg-surface-2/40',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'flex size-7 shrink-0 items-center justify-center rounded-lg text-sm',
                            done ? 'bg-warmup/20 text-warmup' : 'bg-surface-2 text-muted',
                          ].join(' ')}
                        >
                          {done ? '✓' : ''}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{exercise.name}</span>
                          <span className="block text-sm text-muted">
                            {series.map((target) => target.targetText).filter(Boolean).join(' · ') ||
                              'sem alvo'}
                            {series[0]?.restNote ? ` · ${series[0].restNote}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            {/* Preparação não gera registro de carga — é o que mantém o
                histórico de evolução limpo. */}
          </Card>
        ) : null}

        {blocks.length === 0 ? (
          <EmptyState title="Treino sem exercícios" description="Edite o plano para adicioná-los." />
        ) : (
          <ul className="space-y-4">
            {blocks.map((block) => {
              const isGroup = block.group !== null && block.exercises.length > 1
              const mode: GroupMode = session.groupModes[block.group ?? ''] ?? 'paired'
              const paired = isGroup && mode === 'paired'
              const rounds = paired
                ? Math.max(...block.exercises.map((exercise) => rowsFor(exercise).length))
                : 0

              const totalRows = block.exercises.reduce(
                (total, exercise) => total + rowsFor(exercise).length,
                0,
              )
              const feitas = totalRows - pendentesDoBloco(block)
              const aberto = !collapsed.has(block.key)

              return (
                <li key={block.key}>
                  <Card>
                    {/* Cabeçalho sempre visível: nome grande e progresso, para
                        achar o exercício de relance com o card fechado. */}
                    <button
                      onClick={() =>
                        setCollapsed((atual) => {
                          const proximo = new Set(atual)
                          if (proximo.has(block.key)) proximo.delete(block.key)
                          else proximo.add(block.key)
                          return proximo
                        })
                      }
                      className="flex w-full items-start gap-2 text-left"
                      aria-expanded={aberto}
                    >
                      <div className="min-w-0 flex-1">
                        {block.exercises.map((exercise) => (
                          <span key={exercise.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold leading-snug">
                              {exercise.name}
                            </span>
                            <SectionBadge section={exercise.section} />
                          </span>
                        ))}
                        <span className="mt-1 block text-sm text-muted">
                          {feitas === totalRows && totalRows > 0 ? (
                            <span className="text-main">✓ {totalRows} série(s) concluída(s)</span>
                          ) : (
                            `${feitas}/${totalRows} série(s)`
                          )}
                          {isGroup ? ` · bi-set ${block.group}` : ''}
                        </span>
                      </div>
                      <span className="shrink-0 px-1 text-xl text-muted">{aberto ? '−' : '+'}</span>
                    </button>

                    {!aberto ? null : (
                      <>
                    {isGroup ? (
                      <div className="mb-3 mt-3 flex items-center gap-2">
                        <div className="ml-auto flex overflow-hidden rounded-lg border border-border">
                          {(['paired', 'separate'] as GroupMode[]).map((option) => (
                            <button
                              key={option}
                              onClick={() => setGroupMode(session.id, block.group!, option)}
                              className={[
                                'px-3 py-2 text-xs',
                                option === mode ? 'bg-accent/15 text-accent' : 'text-muted',
                              ].join(' ')}
                            >
                              {option === 'paired' ? 'Em bi-set' : 'Separado'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {paired ? (
                      <>
                        <div className="mb-3 mt-3">
                          {block.exercises
                            .map((exercise) => exercise.technique)
                            .filter(Boolean)
                            .map((technique, index) => (
                              <p key={index} className="text-sm text-muted">
                                {technique}
                              </p>
                            ))}
                        </div>

                        <div className="space-y-3">
                          {Array.from({ length: rounds }, (_, index) => index + 1).map((round) => {
                            // O descanso só entra depois do último exercício do
                            // par — é o que diferencia bi-set de séries soltas.
                            const withRows = block.exercises.filter(
                              (exercise) => rowsFor(exercise)[round - 1],
                            )
                            const last = withRows.at(-1)
                            return (
                              <div key={round} className="rounded-xl border border-border/60 p-2">
                                <p className="mb-2 px-1 text-xs font-medium text-muted">
                                  Rodada {round}
                                </p>
                                <div className="space-y-2">
                                  {withRows.map((exercise) => {
                                    const row = rowsFor(exercise)[round - 1]
                                    const chave = logKey(exercise.id, row.seriesNumber)
                                    const log = logsByKey.get(chave)
                                    return (
                                      <div key={exercise.id}>
                                        <p className="mb-1 px-1 text-xs text-muted">
                                          {exercise.name}
                                        </p>
                                        <SetRow
                                          seriesNumber={row.seriesNumber}
                                          targetText={row.target?.targetText ?? ''}
                                          restText={row.target ? restLabel(row.target) : ''}
                                          log={log}
                                          prefill={prefills
                                            .get(exercise.id)
                                            ?.get(row.seriesNumber)}
                                          isExtra={row.isExtra}
                                          draft={drafts[chave]}
                                          defaultDraft={defaultDraftFor(exercise, row)}
                                          onDraftChange={(next) =>
                                            setDrafts((atual) => ({ ...atual, [chave]: next }))
                                          }
                                          onComplete={() =>
                                            complete(block, exercise, row, exercise.id === last?.id)
                                          }
                                          onUndo={() => log && deleteSetLog(log.id)}
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button full size="sm" onClick={() => addExtra(block.exercises)}>
                            + rodada extra
                          </Button>
                          {pendentesDoBloco(block) > 0 ? (
                            <Button
                              full
                              size="sm"
                              variant="primary"
                              onClick={async () => {
                                for (const exercise of block.exercises) {
                                  await completeAll(block, exercise)
                                }
                              }}
                            >
                              Concluir todas
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 space-y-5">
                        {block.exercises.map((exercise) => {
                          const pendentes = rowsFor(exercise).filter(
                            (row) => !logsByKey.has(logKey(exercise.id, row.seriesNumber)),
                          ).length
                          return (
                            <div key={exercise.id}>
                              {/* Com dois exercícios no bloco (bi-set separado),
                                  o nome volta aqui para não confundir as séries. */}
                              {block.exercises.length > 1 ? (
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">{exercise.name}</span>
                                  <SectionBadge section={exercise.section} />
                                </div>
                              ) : null}
                              {exercise.technique ? (
                                <p className="mb-2 text-sm text-muted">{exercise.technique}</p>
                              ) : null}
                              {renderExerciseRows(block, exercise)}
                              <div className="mt-2 flex gap-2">
                                <Button full size="sm" onClick={() => addExtra([exercise])}>
                                  + série extra
                                </Button>
                                {pendentes > 1 ? (
                                  <Button
                                    full
                                    size="sm"
                                    variant="primary"
                                    onClick={() => completeAll(block, exercise)}
                                  >
                                    Concluir todas ({pendentes})
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                      </>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}

        {isOpen ? (
          <Button full size="lg" variant="primary" className="mt-6" onClick={() => setFinishOpen(true)}>
            Encerrar treino
          </Button>
        ) : null}
      </Screen>

      <RestTimerBar timer={timer} />

      <ConfirmDialog
        open={finishOpen}
        title="Encerrar treino?"
        confirmLabel="Encerrar"
        description={`${doneCount} série(s) registrada(s). Você pode reabrir pelo histórico se precisar.`}
        onClose={() => setFinishOpen(false)}
        onConfirm={async () => {
          timer.stop()
          await finishSession(session.id)
          // A foto vem depois de encerrar: o treino já está salvo, tirar ou não
          // a foto não muda isso.
          setPhotoOpen(true)
        }}
      />

      <SessionPhotoSheet
        open={photoOpen}
        profileId={profile.id}
        sessionId={session.id}
        dateKey={session.dateKey}
        onDone={() => {
          setPhotoOpen(false)
          navigate('/historico', { replace: true })
        }}
      />
    </div>
  )
}

function Elapsed({ startedAt, running }: { startedAt: number; running: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  const startedRef = useRef(startedAt)
  startedRef.current = startedAt

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [running])

  return <>{formatDuration(now - startedAt)}</>
}
