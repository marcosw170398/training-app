import { db } from '@/db/db'
import {
  NO_WEEK,
  type Exercise,
  type Id,
  type SeriesTarget,
  type TrainingPlan,
  type Workout,
} from '@/db/schema'
import { newId } from '@/lib/id'
import { toExerciseKey } from '@/lib/exerciseKey'
import type { ParsedPlan } from './parsedPlan'

/**
 * Grava o plano conferido. Roda numa transação só: um plano pela metade no
 * banco seria pior que nenhum.
 */
export async function saveParsedPlan(profileId: Id, parsed: ParsedPlan): Promise<Id> {
  const agora = Date.now()
  const planId = newId()

  const plan: TrainingPlan = {
    id: planId,
    profileId,
    name: parsed.name.trim() || 'Plano importado',
    type: parsed.type,
    totalWeeks: parsed.type === 'periodized' ? parsed.totalWeeks : 0,
    notes: null,
    createdAt: agora,
    updatedAt: agora,
  }

  const workouts: Workout[] = []
  const exercises: Exercise[] = []
  const series: SeriesTarget[] = []

  // A ordem dentro de cada semana é a ordem em que os treinos aparecem no PDF.
  const ordemPorSemana = new Map<number, number>()

  for (const parsedWorkout of parsed.workouts) {
    const weekNumber = parsed.type === 'periodized' ? parsedWorkout.weekNumber : NO_WEEK
    const ordem = ordemPorSemana.get(weekNumber) ?? 0
    ordemPorSemana.set(weekNumber, ordem + 1)

    const workoutId = newId()
    workouts.push({
      id: workoutId,
      profileId,
      planId,
      name: parsedWorkout.name.trim(),
      weekNumber,
      weekday: parsedWorkout.weekday,
      order: ordem,
      notes: null,
    })

    parsedWorkout.exercises.forEach((parsedExercise, index) => {
      const exerciseId = newId()
      exercises.push({
        id: exerciseId,
        profileId,
        workoutId,
        name: parsedExercise.name.trim(),
        exerciseKey: toExerciseKey(parsedExercise.name),
        section: parsedExercise.section,
        // Trim só aqui, na gravação — durante a digitação ele impediria o
        // usuário de teclar espaço.
        technique: parsedExercise.technique?.trim() || null,
        supersetGroup: null,
        order: index,
        notes: null,
      })

      parsedExercise.series.forEach((parsedSeries, seriesIndex) => {
        series.push({
          id: newId(),
          profileId,
          exerciseId,
          seriesNumber: seriesIndex + 1,
          targetText: parsedSeries.targetText,
          restSecondsMin: parsedSeries.restSecondsMin,
          restSecondsMax: parsedSeries.restSecondsMax,
          restNote: parsedSeries.restNote,
        })
      })
    })
  }

  await db.transaction(
    'rw',
    [db.plans, db.workouts, db.exercises, db.seriesTargets],
    async () => {
      await db.plans.add(plan)
      if (workouts.length) await db.workouts.bulkAdd(workouts)
      if (exercises.length) await db.exercises.bulkAdd(exercises)
      if (series.length) await db.seriesTargets.bulkAdd(series)
    },
  )

  return planId
}
