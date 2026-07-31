import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { NO_WEEK, type Workout } from '@/db/schema'
import { getPlan } from '@/db/repositories/plans.repo'
import {
  createWorkout,
  deleteWorkoutCascade,
  duplicateWeek,
  duplicateWorkout,
  listWorkoutsOfWeek,
  reorderWorkouts,
  updateWorkout,
} from '@/db/repositories/workouts.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { weekdayLabel } from '@/lib/weekday'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Sheet } from '@/components/ui/Sheet'
import { Splash } from '@/app/Splash'
import { WorkoutFormSheet } from './WorkoutFormSheet'

export function PlanEditorScreen() {
  const { planId = '' } = useParams()
  const navigate = useNavigate()
  const profile = useActiveProfile()

  const [week, setWeek] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Workout | undefined>()
  const [toDelete, setToDelete] = useState<Workout | undefined>()
  const [copyOpen, setCopyOpen] = useState(false)

  const data = useLiveQuery(async () => {
    const plan = await getPlan(planId)
    if (!plan) return null
    const activeWeek = plan.type === 'periodized' ? week : NO_WEEK
    const workouts = await listWorkoutsOfWeek(planId, activeWeek)
    const counts = await Promise.all(
      workouts.map((workout) =>
        db.exercises.where('workoutId').equals(workout.id).count(),
      ),
    )
    return { plan, workouts, counts, activeWeek }
  }, [planId, week])

  if (!profile) return <Splash />
  if (data === undefined) return <Splash />
  if (data === null) {
    return (
      <Screen title="Plano" back="/planos">
        <EmptyState title="Plano não encontrado" />
      </Screen>
    )
  }

  const { plan, workouts, counts, activeWeek } = data
  const isPeriodized = plan.type === 'periodized'

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...workouts]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    await reorderWorkouts(next.map((workout) => workout.id))
  }

  return (
    <Screen
      title={plan.name}
      subtitle={isPeriodized ? `Periodizado · ${plan.totalWeeks} semanas` : 'Fixo · A, B, C…'}
      back="/planos"
    >
      {isPeriodized ? (
        <div className="-mx-4 mb-4 overflow-x-auto px-4">
          <div className="flex gap-2">
            {Array.from({ length: plan.totalWeeks }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                onClick={() => setWeek(number)}
                className={[
                  'min-h-11 shrink-0 rounded-xl border px-4 text-sm',
                  number === week ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-2',
                ].join(' ')}
              >
                Semana {String(number).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {workouts.length === 0 ? (
        <EmptyState
          title={isPeriodized ? `Semana ${String(week).padStart(2, '0')} vazia` : 'Nenhum treino ainda'}
          description={
            isPeriodized
              ? 'Crie os treinos desta semana, ou copie de uma semana já montada.'
              : 'Crie os treinos do ciclo (Treino A, Treino B…).'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(undefined)
                  setFormOpen(true)
                }}
              >
                Novo treino
              </Button>
              {isPeriodized ? (
                <Button onClick={() => setCopyOpen(true)}>Copiar semana</Button>
              ) : null}
            </div>
          }
        />
      ) : (
        <ul className="space-y-3">
          {workouts.map((workout, index) => (
            <li key={workout.id}>
              <Card>
                <button
                  className="w-full text-left"
                  onClick={() => navigate(`/planos/${planId}/t/${workout.id}`)}
                >
                  <p className="font-display font-semibold">{workout.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {workout.weekday ? `${weekdayLabel(workout.weekday)} · ` : ''}
                    {counts[index]} exercício(s)
                  </p>
                </button>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" aria-label="Subir" onClick={() => move(index, -1)} disabled={index === 0}>
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    aria-label="Descer"
                    onClick={() => move(index, 1)}
                    disabled={index === workouts.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(workout)
                      setFormOpen(true)
                    }}
                  >
                    Renomear
                  </Button>
                  <Button size="sm" onClick={() => duplicateWorkout(workout.id, {})}>
                    Duplicar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setToDelete(workout)}>
                    Excluir
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {workouts.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          <Button
            full
            size="lg"
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
          >
            Novo treino
          </Button>
          {isPeriodized ? (
            <Button full variant="ghost" onClick={() => setCopyOpen(true)}>
              Copiar treinos de outra semana para cá
            </Button>
          ) : null}
        </div>
      ) : null}

      <WorkoutFormSheet
        open={formOpen}
        workout={editing}
        suggestedName={
          isPeriodized ? '' : `Treino ${String.fromCharCode(65 + workouts.length)}`
        }
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) {
            await updateWorkout(editing.id, values)
            return
          }
          await createWorkout(profile.id, planId, { ...values, weekNumber: activeWeek })
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title={`Excluir "${toDelete?.name ?? ''}"?`}
        confirmLabel="Excluir treino"
        description="Os exercícios e séries deste treino são apagados. O histórico já registrado é preservado."
        onClose={() => setToDelete(undefined)}
        onConfirm={async () => {
          if (toDelete) await deleteWorkoutCascade(toDelete.id)
        }}
      />

      {/* Copiar semana é o atalho que torna o plano periodizado viável de
          cadastrar à mão: monta-se a Semana 01 e ajusta-se só o que muda. */}
      <Sheet open={copyOpen} title="Copiar semana" onClose={() => setCopyOpen(false)}>
        <p className="mb-4 text-sm text-muted">
          Copia todos os treinos (com exercícios e séries) da semana escolhida para a semana{' '}
          {String(week).padStart(2, '0')}.
        </p>
        <div className="grid grid-cols-3 gap-2 pb-2">
          {Array.from({ length: plan.totalWeeks }, (_, index) => index + 1)
            .filter((number) => number !== week)
            .map((number) => (
              <Button
                key={number}
                onClick={async () => {
                  await duplicateWeek(planId, number, week)
                  setCopyOpen(false)
                }}
              >
                Semana {String(number).padStart(2, '0')}
              </Button>
            ))}
        </div>
      </Sheet>
    </Screen>
  )
}
