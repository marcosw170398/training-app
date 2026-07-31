import { useState } from 'react'
import { useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { SECTION_LABEL, type Exercise, type Id, type Section } from '@/db/schema'
import {
  addSeries,
  createExercise,
  deleteExerciseCascade,
  duplicateExercise,
  listExercises,
  listSeriesOfWorkout,
  reorderExercises,
  updateExercise,
} from '@/db/repositories/exercises.repo'
import { getWorkout } from '@/db/repositories/workouts.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { weekdayLabel } from '@/lib/weekday'
import { deaccent } from '@/lib/text'
import { Screen } from '@/components/ui/Screen'
import { Card, EmptyState } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionBadge } from '@/components/ui/SectionBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Splash } from '@/app/Splash'
import { ExerciseFormSheet } from './ExerciseFormSheet'
import { SeriesRow } from './SeriesRow'

export function WorkoutEditorScreen() {
  const { planId = '', workoutId = '' } = useParams()
  const profile = useActiveProfile()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | undefined>()
  const [newSection, setNewSection] = useState<Section>('main')
  const [toDelete, setToDelete] = useState<Exercise | undefined>()
  const [expanded, setExpanded] = useState<Id | null>(null)

  const data = useLiveQuery(async () => {
    const workout = await getWorkout(workoutId)
    if (!workout) return null
    const [exercises, seriesByExercise] = await Promise.all([
      listExercises(workoutId),
      listSeriesOfWorkout(workoutId),
    ])
    return { workout, exercises, seriesByExercise }
  }, [workoutId])

  if (!profile || data === undefined) return <Splash />
  if (data === null) {
    return (
      <Screen title="Treino" back={`/planos/${planId}`}>
        <EmptyState title="Treino não encontrado" />
      </Screen>
    )
  }

  const { workout, exercises, seriesByExercise } = data

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...exercises]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    await reorderExercises(next.map((exercise) => exercise.id))
  }

  const openNew = (section: Section) => {
    setEditing(undefined)
    setNewSection(section)
    setFormOpen(true)
  }

  // Um plano importado costuma nomear o treino pelo próprio dia
  // ("SEGUNDA-FEIRA"), e mostrar "Segunda-feira" nesse caso duplicaria o
  // título — e pior, ESCONDIA a contagem de exercícios. Mostra o dia só
  // quando ele não repete o que o título já diz.
  const diaJaNoTitulo = workout.weekday
    ? deaccent(workout.name).includes(deaccent(weekdayLabel(workout.weekday)))
    : false
  const partesSubtitulo = [
    workout.weekday && !diaJaNoTitulo ? weekdayLabel(workout.weekday) : null,
    `${exercises.length} exercício(s)`,
  ].filter(Boolean)

  return (
    <Screen
      title={workout.name}
      subtitle={partesSubtitulo.join(' · ')}
      back={`/planos/${planId}`}
    >
      {exercises.length === 0 ? (
        <EmptyState
          title="Nenhum exercício"
          description="Adicione a preparação e os exercícios principais deste treino."
          action={
            <Button variant="primary" onClick={() => openNew('main')}>
              Adicionar exercício
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {exercises.map((exercise, index) => {
            const series = seriesByExercise.get(exercise.id) ?? []
            const isOpen = expanded === exercise.id
            return (
              <li key={exercise.id}>
                <Card>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{exercise.name}</span>
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
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" aria-label="Subir" onClick={() => move(index, -1)} disabled={index === 0}>
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      aria-label="Descer"
                      onClick={() => move(index, 1)}
                      disabled={index === exercises.length - 1}
                    >
                      ↓
                    </Button>
                    <Button size="sm" onClick={() => setExpanded(isOpen ? null : exercise.id)}>
                      {isOpen ? 'Fechar séries' : `Séries (${series.length})`}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(exercise)
                        setFormOpen(true)
                      }}
                    >
                      Editar
                    </Button>
                    <Button size="sm" onClick={() => duplicateExercise(exercise.id)}>
                      Duplicar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setToDelete(exercise)}>
                      Excluir
                    </Button>
                  </div>

                  {isOpen ? (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {series.map((target) => (
                        <SeriesRow key={target.id} target={target} />
                      ))}
                      <Button
                        full
                        size="sm"
                        onClick={() => addSeries(profile.id, exercise.id)}
                      >
                        + Adicionar série
                      </Button>
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-6 space-y-2">
        {(['warmup', 'rampup', 'main'] as Section[]).map((section) => (
          <Button key={section} full onClick={() => openNew(section)}>
            + {SECTION_LABEL[section]}
          </Button>
        ))}
      </div>

      <ExerciseFormSheet
        open={formOpen}
        exercise={editing}
        defaultSection={newSection}
        onClose={() => setFormOpen(false)}
        onSubmit={async (values) => {
          if (editing) {
            await updateExercise(editing.id, values)
            return
          }
          const created = await createExercise(profile.id, workoutId, values)
          // Exercício sem série nenhuma não serve para nada na execução.
          await addSeries(profile.id, created.id, { targetText: '' })
          setExpanded(created.id)
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title={`Excluir "${toDelete?.name ?? ''}"?`}
        confirmLabel="Excluir exercício"
        description="As séries deste exercício são apagadas. O histórico já registrado é preservado."
        onClose={() => setToDelete(undefined)}
        onConfirm={async () => {
          if (toDelete) await deleteExerciseCascade(toDelete.id)
        }}
      />
    </Screen>
  )
}
