import Dexie from 'dexie'
import { db } from '../db'
import type { Exercise, Id, Section, SeriesTarget, SetLog } from '../schema'
import { newId } from '@/lib/id'
import { toDateKey } from '@/lib/date'

/**
 * Última série registrada daquele movimento + seção + número de série.
 *
 * A busca é por `exerciseKey` (não por `exerciseId`) de propósito: no plano
 * periodizado o "Supino máquina" da Semana 04 é OUTRA linha `Exercise` que a da
 * Semana 01. Buscar por id devolveria vazio toda semana e a progressão do ciclo
 * — que é o objetivo do formato periodizado — ficaria invisível.
 */
export function lastSetFor(
  profileId: Id,
  exerciseKey: string,
  section: Section,
  seriesNumber: number,
): Promise<SetLog | undefined> {
  return db.setLogs
    .where('[profileId+exerciseKey+section+seriesNumber+performedAt]')
    .between(
      [profileId, exerciseKey, section, seriesNumber, Dexie.minKey],
      [profileId, exerciseKey, section, seriesNumber, Dexie.maxKey],
    )
    .last()
}

/** Pré-preenchimento de um exercício inteiro: uma busca por série. */
export async function lastSetsForExercise(
  profileId: Id,
  exerciseKey: string,
  section: Section,
  seriesNumbers: number[],
): Promise<Map<number, SetLog>> {
  const entries = await Promise.all(
    seriesNumbers.map(async (n) => [n, await lastSetFor(profileId, exerciseKey, section, n)] as const),
  )
  const map = new Map<number, SetLog>()
  for (const [n, log] of entries) if (log) map.set(n, log)
  return map
}

export function listSetLogsOfSession(sessionId: Id): Promise<SetLog[]> {
  return db.setLogs.where('sessionId').equals(sessionId).sortBy('performedAt')
}

/** Série temporal de um movimento — base do dashboard de evolução futuro. */
export function historyForExercise(
  profileId: Id,
  exerciseKey: string,
  section: Section = 'main',
): Promise<SetLog[]> {
  return db.setLogs
    .where('[profileId+exerciseKey+section+performedAt]')
    .between(
      [profileId, exerciseKey, section, Dexie.minKey],
      [profileId, exerciseKey, section, Dexie.maxKey],
    )
    .reverse()
    .toArray()
}

export async function logSet(input: {
  profileId: Id
  sessionId: Id
  exercise: Exercise
  seriesTarget: SeriesTarget | null
  seriesNumber: number
  targetText: string
  weight: number | null
  reps: number | null
  durationSeconds?: number | null
  notes?: string | null
}): Promise<SetLog> {
  if (input.exercise.section === 'warmup') {
    // Preparação geral não entra no histórico — é justamente essa ausência que
    // mantém a evolução de cargas limpa.
    throw new Error('Exercícios de preparação não geram registro de carga')
  }

  const now = Date.now()
  const log: SetLog = {
    id: newId(),
    profileId: input.profileId,
    sessionId: input.sessionId,
    exerciseId: input.exercise.id,
    exerciseKey: input.exercise.exerciseKey,
    // Snapshots: o histórico sobrevive a renomear ou apagar o exercício.
    exerciseName: input.exercise.name,
    section: input.exercise.section,
    seriesTargetId: input.seriesTarget?.id ?? null,
    seriesNumber: input.seriesNumber,
    targetText: input.targetText,
    weight: input.weight,
    weightUnit: 'kg',
    reps: input.reps,
    durationSeconds: input.durationSeconds ?? null,
    performedAt: now,
    dateKey: toDateKey(now),
    notes: input.notes ?? null,
  }
  await db.setLogs.add(log)
  return log
}

export async function updateSetLog(
  id: Id,
  patch: Partial<Pick<SetLog, 'weight' | 'reps' | 'durationSeconds' | 'notes'>>,
): Promise<void> {
  await db.setLogs.update(id, patch)
}

export async function deleteSetLog(id: Id): Promise<void> {
  await db.setLogs.delete(id)
}

/** Movimentos distintos já registrados pelo perfil — índice do histórico. */
export async function listLoggedExercises(
  profileId: Id,
): Promise<{ exerciseKey: string; name: string; lastAt: number; count: number }[]> {
  const logs = await db.setLogs.where('profileId').equals(profileId).toArray()
  const byKey = new Map<string, { exerciseKey: string; name: string; lastAt: number; count: number }>()
  for (const log of logs) {
    if (log.section !== 'main') continue
    const current = byKey.get(log.exerciseKey)
    if (!current) {
      byKey.set(log.exerciseKey, {
        exerciseKey: log.exerciseKey,
        name: log.exerciseName,
        lastAt: log.performedAt,
        count: 1,
      })
    } else {
      current.count += 1
      if (log.performedAt > current.lastAt) {
        current.lastAt = log.performedAt
        current.name = log.exerciseName
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastAt - a.lastAt)
}
