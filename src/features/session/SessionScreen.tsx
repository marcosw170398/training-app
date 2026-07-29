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
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionBadge } from '@/components/ui/SectionBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Splash } from '@/app/Splash'
import { RestTimerBar } from './RestTimerBar'
import { SetRow, type SetValues } from './SetRow'

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

  const complete = async (exercise: Exercise, row: Row, values: SetValues, withRest: boolean) => {
    await logSet({
      profileId: profile.id,
      sessionId: session.id,
      exercise,
      seriesTarget: row.target,
      seriesNumber: row.seriesNumber,
      targetText: row.target?.targetText ?? '',
      weight: values.weight,
      reps: values.reps,
      durationSeconds: values.durationSeconds,
    })
    if (withRest) startRest(exercise, row)
  }

  const renderExerciseRows = (exercise: Exercise, withRest = true) => (
    <div className="space-y-2">
      {rowsFor(exercise).map((row) => {
        const log = logsByKey.get(logKey(exercise.id, row.seriesNumber))
        return (
          <SetRow
            key={`${exercise.id}-${row.seriesNumber}`}
            seriesNumber={row.seriesNumber}
            targetText={row.target?.targetText ?? ''}
            restText={row.target ? restLabel(row.target) : ''}
            log={log}
            prefill={prefills.get(exercise.id)?.get(row.seriesNumber)}
            isExtra={row.isExtra}
            onComplete={(values) => complete(exercise, row, values, withRest)}
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

              return (
                <li key={block.key}>
                  <Card>
                    {isGroup ? (
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                          bi-set {block.group}
                        </span>
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
                        <div className="mb-3">
                          {block.exercises.map((exercise) => (
                            <p key={exercise.id} className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{exercise.name}</span>
                              <SectionBadge section={exercise.section} />
                            </p>
                          ))}
                          {block.exercises
                            .map((exercise) => exercise.technique)
                            .filter(Boolean)
                            .map((technique, index) => (
                              <p key={index} className="mt-1 text-sm text-muted">
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
                                    const log = logsByKey.get(logKey(exercise.id, row.seriesNumber))
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
                                          onComplete={(values) =>
                                            complete(
                                              exercise,
                                              row,
                                              values,
                                              exercise.id === last?.id,
                                            )
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

                        <Button
                          full
                          size="sm"
                          className="mt-3"
                          onClick={() => addExtra(block.exercises)}
                        >
                          + rodada extra
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-5">
                        {block.exercises.map((exercise) => (
                          <div key={exercise.id}>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{exercise.name}</span>
                              <SectionBadge section={exercise.section} />
                            </div>
                            {exercise.technique ? (
                              <p className="mb-2 text-sm text-muted">{exercise.technique}</p>
                            ) : null}
                            {renderExerciseRows(exercise)}
                            <Button
                              full
                              size="sm"
                              className="mt-2"
                              onClick={() => addExtra([exercise])}
                            >
                              + série extra
                            </Button>
                          </div>
                        ))}
                      </div>
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
