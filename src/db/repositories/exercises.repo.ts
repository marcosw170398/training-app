import Dexie from 'dexie'
import { db } from '../db'
import type { Exercise, Id, Section, SeriesTarget } from '../schema'
import { newId } from '@/lib/id'
import { toExerciseKey } from '@/lib/exerciseKey'

export function listExercises(workoutId: Id): Promise<Exercise[]> {
  return db.exercises
    .where('[workoutId+order]')
    .between([workoutId, Dexie.minKey], [workoutId, Dexie.maxKey])
    .toArray()
}

export function getExercise(id: Id): Promise<Exercise | undefined> {
  return db.exercises.get(id)
}

export function listSeries(exerciseId: Id): Promise<SeriesTarget[]> {
  return db.seriesTargets
    .where('[exerciseId+seriesNumber]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .toArray()
}

export async function listSeriesOfWorkout(workoutId: Id): Promise<Map<Id, SeriesTarget[]>> {
  const exercises = await listExercises(workoutId)
  const all = await db.seriesTargets
    .where('exerciseId')
    .anyOf(exercises.map((e) => e.id))
    .toArray()

  const byExercise = new Map<Id, SeriesTarget[]>()
  for (const exercise of exercises) byExercise.set(exercise.id, [])
  for (const target of all) byExercise.get(target.exerciseId)?.push(target)
  for (const list of byExercise.values()) list.sort((a, b) => a.seriesNumber - b.seriesNumber)
  return byExercise
}

export async function createExercise(
  profileId: Id,
  workoutId: Id,
  input: {
    name: string
    section: Section
    technique?: string | null
    supersetGroup?: string | null
    notes?: string | null
  },
): Promise<Exercise> {
  const siblings = await listExercises(workoutId)
  const exercise: Exercise = {
    id: newId(),
    profileId,
    workoutId,
    name: input.name.trim(),
    exerciseKey: toExerciseKey(input.name),
    section: input.section,
    technique: input.technique ?? null,
    supersetGroup: input.supersetGroup ?? null,
    order: siblings.length,
    notes: input.notes ?? null,
  }
  await db.exercises.add(exercise)
  return exercise
}

export async function updateExercise(
  id: Id,
  patch: Partial<Pick<Exercise, 'name' | 'section' | 'technique' | 'supersetGroup' | 'order' | 'notes'>>,
): Promise<void> {
  // O nome é a fonte da chave de evolução: renomear precisa reescrever a chave,
  // senão o exercício perde o vínculo com o próprio histórico futuro.
  const full = patch.name !== undefined ? { ...patch, exerciseKey: toExerciseKey(patch.name) } : patch
  await db.exercises.update(id, full)
}

export async function reorderExercises(ids: Id[]): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    await Promise.all(ids.map((id, index) => db.exercises.update(id, { order: index })))
  })
}

export async function deleteExerciseCascade(exerciseId: Id): Promise<void> {
  await db.transaction('rw', [db.exercises, db.seriesTargets], async () => {
    await db.seriesTargets.where('exerciseId').equals(exerciseId).delete()
    await db.exercises.delete(exerciseId)
  })
}

export async function duplicateExercise(exerciseId: Id): Promise<Id> {
  const source = await db.exercises.get(exerciseId)
  if (!source) throw new Error('Exercício não encontrado')
  const newExerciseId = newId()

  await db.transaction('rw', [db.exercises, db.seriesTargets], async () => {
    const siblings = await listExercises(source.workoutId)
    await db.exercises.add({
      ...source,
      id: newExerciseId,
      order: siblings.length,
    })
    const series = await listSeries(exerciseId)
    if (series.length) {
      await db.seriesTargets.bulkAdd(
        series.map((target) => ({ ...target, id: newId(), exerciseId: newExerciseId })),
      )
    }
  })
  return newExerciseId
}

export async function addSeries(
  profileId: Id,
  exerciseId: Id,
  input?: Partial<Omit<SeriesTarget, 'id' | 'profileId' | 'exerciseId' | 'seriesNumber'>>,
): Promise<SeriesTarget> {
  const existing = await listSeries(exerciseId)
  const previous = existing.at(-1)
  const target: SeriesTarget = {
    id: newId(),
    profileId,
    exerciseId,
    seriesNumber: (previous?.seriesNumber ?? 0) + 1,
    // Herdar do anterior economiza digitação: descanso quase sempre se repete.
    targetText: input?.targetText ?? previous?.targetText ?? '',
    restSecondsMin: input?.restSecondsMin ?? previous?.restSecondsMin ?? null,
    restSecondsMax: input?.restSecondsMax ?? previous?.restSecondsMax ?? null,
    restNote: input?.restNote ?? previous?.restNote ?? null,
  }
  await db.seriesTargets.add(target)
  return target
}

export async function updateSeries(
  id: Id,
  patch: Partial<Pick<SeriesTarget, 'targetText' | 'restSecondsMin' | 'restSecondsMax' | 'restNote'>>,
): Promise<void> {
  await db.seriesTargets.update(id, patch)
}

/** Remove a série e renumera as seguintes para não deixar buraco. */
export async function deleteSeries(id: Id): Promise<void> {
  const target = await db.seriesTargets.get(id)
  if (!target) return
  await db.transaction('rw', db.seriesTargets, async () => {
    await db.seriesTargets.delete(id)
    const rest = await listSeries(target.exerciseId)
    await Promise.all(
      rest.map((item, index) => db.seriesTargets.update(item.id, { seriesNumber: index + 1 })),
    )
  })
}

/** Aplica o mesmo descanso a todas as séries do exercício. */
export async function applyRestToAllSeries(
  exerciseId: Id,
  rest: { restSecondsMin: number | null; restSecondsMax: number | null; restNote: string | null },
): Promise<void> {
  const series = await listSeries(exerciseId)
  await db.transaction('rw', db.seriesTargets, async () => {
    await Promise.all(series.map((target) => db.seriesTargets.update(target.id, rest)))
  })
}
