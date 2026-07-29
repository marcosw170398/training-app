import Dexie from 'dexie'
import { db } from '../db'
import { NO_WEEK, NO_WEEKDAY, type Exercise, type Id, type SeriesTarget, type Workout } from '../schema'
import { newId } from '@/lib/id'
import { touchPlan } from './plans.repo'

/**
 * Treinos de uma semana específica. Para plano fixo, `weekNumber` é NO_WEEK (0)
 * — a MESMA query serve os dois tipos de plano, que é exatamente o que a
 * sentinela numérica compra.
 */
export function listWorkoutsOfWeek(planId: Id, weekNumber: number): Promise<Workout[]> {
  return db.workouts
    .where('[planId+weekNumber+order]')
    .between([planId, weekNumber, Dexie.minKey], [planId, weekNumber, Dexie.maxKey])
    .toArray()
}

/** Todos os treinos do plano, ordenados por semana e depois por ordem. */
export function listWorkoutsOfPlan(planId: Id): Promise<Workout[]> {
  return db.workouts
    .where('[planId+weekNumber+order]')
    .between(
      [planId, Dexie.minKey, Dexie.minKey],
      [planId, Dexie.maxKey, Dexie.maxKey],
    )
    .toArray()
}

export function getWorkout(id: Id): Promise<Workout | undefined> {
  return db.workouts.get(id)
}

export async function createWorkout(
  profileId: Id,
  planId: Id,
  input: { name: string; weekNumber?: number; weekday?: number; notes?: string | null },
): Promise<Workout> {
  const weekNumber = input.weekNumber ?? NO_WEEK
  const siblings = await listWorkoutsOfWeek(planId, weekNumber)
  const workout: Workout = {
    id: newId(),
    profileId,
    planId,
    name: input.name.trim(),
    weekNumber,
    weekday: input.weekday ?? NO_WEEKDAY,
    order: siblings.length,
    notes: input.notes ?? null,
  }
  await db.workouts.add(workout)
  await touchPlan(planId)
  return workout
}

export async function updateWorkout(
  id: Id,
  patch: Partial<Pick<Workout, 'name' | 'weekNumber' | 'weekday' | 'order' | 'notes'>>,
): Promise<void> {
  await db.workouts.update(id, patch)
  const workout = await db.workouts.get(id)
  if (workout) await touchPlan(workout.planId)
}

export async function reorderWorkouts(ids: Id[]): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    await Promise.all(ids.map((id, index) => db.workouts.update(id, { order: index })))
  })
}

export async function deleteWorkoutCascade(workoutId: Id): Promise<void> {
  await db.transaction('rw', [db.workouts, db.exercises, db.seriesTargets], async () => {
    const exerciseIds = (await db.exercises.where('workoutId').equals(workoutId).toArray()).map(
      (e) => e.id,
    )
    await db.seriesTargets.where('exerciseId').anyOf(exerciseIds).delete()
    await db.exercises.where('workoutId').equals(workoutId).delete()
    await db.workouts.delete(workoutId)
  })
}

/**
 * Cópia profunda de um treino (exercícios + séries).
 *
 * É o atalho que torna o plano periodizado viável de cadastrar à mão: monta-se
 * a Semana 01 e duplica-se para a 02, ajustando só os alvos que mudaram.
 */
export async function duplicateWorkout(
  workoutId: Id,
  target: { weekNumber?: number; name?: string },
): Promise<Id> {
  const source = await db.workouts.get(workoutId)
  if (!source) throw new Error('Treino não encontrado')

  const weekNumber = target.weekNumber ?? source.weekNumber
  const newWorkoutId = newId()

  await db.transaction('rw', [db.workouts, db.exercises, db.seriesTargets, db.plans], async () => {
    const siblings = await db.workouts
      .where('[planId+weekNumber+order]')
      .between([source.planId, weekNumber, Dexie.minKey], [source.planId, weekNumber, Dexie.maxKey])
      .toArray()

    await db.workouts.add({
      ...source,
      id: newWorkoutId,
      weekNumber,
      name: target.name ?? source.name,
      order: siblings.length,
    })

    const exercises = await db.exercises.where('workoutId').equals(workoutId).toArray()
    const clonedExercises: Exercise[] = []
    const clonedSeries: SeriesTarget[] = []

    for (const exercise of exercises) {
      const newExerciseId = newId()
      clonedExercises.push({ ...exercise, id: newExerciseId, workoutId: newWorkoutId })
      const series = await db.seriesTargets.where('exerciseId').equals(exercise.id).toArray()
      for (const seriesTarget of series) {
        clonedSeries.push({ ...seriesTarget, id: newId(), exerciseId: newExerciseId })
      }
    }

    if (clonedExercises.length) await db.exercises.bulkAdd(clonedExercises)
    if (clonedSeries.length) await db.seriesTargets.bulkAdd(clonedSeries)
    await db.plans.update(source.planId, { updatedAt: Date.now() })
  })

  return newWorkoutId
}

/** Duplica todos os treinos de uma semana para outra. */
export async function duplicateWeek(planId: Id, fromWeek: number, toWeek: number): Promise<void> {
  const workouts = await listWorkoutsOfWeek(planId, fromWeek)
  for (const workout of workouts) {
    await duplicateWorkout(workout.id, { weekNumber: toWeek })
  }
}
