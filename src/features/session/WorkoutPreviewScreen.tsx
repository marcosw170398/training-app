import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { NO_WEEK } from '@/db/schema'
import { getWorkout } from '@/db/repositories/workouts.repo'
import { listExercises, listSeriesOfWorkout } from '@/db/repositories/exercises.repo'
import { getProfileState } from '@/db/repositories/profiles.repo'
import { getInProgressSession, startOrResumeSession } from '@/db/repositories/sessions.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { formatDuration } from '@/lib/date'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionBadge } from '@/components/ui/SectionBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Splash } from '@/app/Splash'

/**
 * Abrir um treino só MOSTRA os exercícios — nunca inicia ou encerra sessão
 * sozinho. Isso já foi um bug real: tocar num treino da home enquanto outro
 * estava em andamento encerrava o antigo e começava o novo sem perguntar.
 * Agora só o botão "Iniciar treino" faz isso, com confirmação quando existe
 * outro treino aberto — o mesmo padrão que "Encerrar treino" já usa.
 */
export function WorkoutPreviewScreen() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const profileId = profile?.id
  const [confirmOpen, setConfirmOpen] = useState(false)

  const data = useLiveQuery(async () => {
    const workout = await getWorkout(workoutId)
    if (!workout) return null
    const [exercises, seriesByExercise, openSession] = await Promise.all([
      listExercises(workoutId),
      listSeriesOfWorkout(workoutId),
      profileId ? getInProgressSession(profileId) : Promise.resolve(undefined),
    ])
    return { workout, exercises, seriesByExercise, openSession }
  }, [workoutId, profileId])

  if (!profile || data === undefined) return <Splash />
  if (data === null) {
    return (
      <Screen title="Treino" back="/home">
        <EmptyState title="Treino não encontrado" />
      </Screen>
    )
  }

  const { workout, exercises, seriesByExercise, openSession } = data
  const mesmoTreinoAberto = openSession?.workoutId === workout.id
  const outroTreinoAberto = openSession && !mesmoTreinoAberto

  const iniciar = async () => {
    const state = await getProfileState(profile.id)
    const session = await startOrResumeSession({
      profileId: profile.id,
      planId: workout.planId,
      workoutId: workout.id,
      workoutName: workout.name,
      weekNumber: workout.weekNumber === NO_WEEK ? NO_WEEK : state.currentWeekNumber,
    })
    navigate(`/sessao/${session.id}`)
  }

  return (
    <Screen title={workout.name} subtitle={`${exercises.length} exercício(s)`} back="/home">
      {mesmoTreinoAberto ? (
        <Card className="mb-4 border-accent/50 bg-accent/10">
          <p className="text-sm text-text">Você já tem esse treino em andamento.</p>
        </Card>
      ) : outroTreinoAberto ? (
        <Card className="mb-4 border-rampup/40 bg-rampup/10">
          <p className="text-sm text-text">
            <span className="font-medium">{openSession.workoutName}</span> está em andamento. Iniciar
            este treino encerra aquele.
          </p>
        </Card>
      ) : null}

      {exercises.length === 0 ? (
        <EmptyState title="Treino sem exercícios" description="Edite o plano para adicioná-los." />
      ) : (
        <ul className="space-y-2">
          {exercises.map((exercise) => {
            const series = seriesByExercise.get(exercise.id) ?? []
            return (
              <li key={exercise.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold">{exercise.name}</span>
                    <SectionBadge section={exercise.section} />
                    {exercise.supersetGroup ? (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                        bi-set {exercise.supersetGroup}
                      </span>
                    ) : null}
                  </div>
                  {exercise.technique ? (
                    <p className="mt-1 text-sm text-muted">{exercise.technique}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted">
                    {series.length === 0
                      ? 'sem séries'
                      : series.map((target) => target.targetText || '—').join(' · ')}
                  </p>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        full
        size="lg"
        variant="primary"
        className="mt-6"
        onClick={() => (mesmoTreinoAberto ? navigate(`/sessao/${openSession.id}`) : outroTreinoAberto ? setConfirmOpen(true) : iniciar())}
      >
        {mesmoTreinoAberto ? 'Continuar treino' : 'Iniciar treino'}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Encerrar o treino em andamento?"
        confirmLabel="Encerrar e iniciar"
        description={
          <p>
            <span className="font-medium text-text">{openSession?.workoutName}</span> está em andamento
            {openSession ? ` há ${formatDuration(Date.now() - openSession.startedAt)}` : ''}. Ele será
            encerrado para iniciar "{workout.name}".
          </p>
        }
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void iniciar()}
      />
    </Screen>
  )
}
