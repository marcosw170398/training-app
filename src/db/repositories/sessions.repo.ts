import Dexie from 'dexie'
import { db } from '../db'
import { IN_PROGRESS, type GroupMode, type Id, type Session } from '../schema'
import { newId } from '@/lib/id'
import { toDateKey } from '@/lib/date'

/**
 * Sessão ainda aberta do perfil, se houver. É o que permite retomar um treino
 * interrompido (bateria acabou, saiu da academia e voltou) em vez de deixar
 * SetLogs órfãos soltos no histórico.
 */
export async function getInProgressSession(profileId: Id): Promise<Session | undefined> {
  return db.sessions.where('[profileId+finishedAt]').equals([profileId, IN_PROGRESS]).first()
}

export function getSession(id: Id): Promise<Session | undefined> {
  return db.sessions.get(id)
}

export function listSessions(profileId: Id, limit = 50): Promise<Session[]> {
  return db.sessions
    .where('[profileId+startedAt]')
    .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray()
}

/** Última sessão de cada treino — alimenta o "última vez: 10/07/2026" da home. */
export async function lastSessionByWorkout(
  profileId: Id,
  workoutIds: Id[],
): Promise<Map<Id, Session>> {
  const result = new Map<Id, Session>()
  await Promise.all(
    workoutIds.map(async (workoutId) => {
      const last = await db.sessions
        .where('[profileId+workoutId+startedAt]')
        .between([profileId, workoutId, Dexie.minKey], [profileId, workoutId, Dexie.maxKey])
        .last()
      if (last) result.set(workoutId, last)
    }),
  )
  return result
}

/**
 * Abre uma sessão para o treino — ou devolve a que já estava aberta.
 * Se houver sessão aberta de OUTRO treino, ela é encerrada antes: dois treinos
 * simultâneos não existem na vida real e quebrariam o índice de sessão aberta.
 */
export async function startOrResumeSession(input: {
  profileId: Id
  planId: Id
  workoutId: Id
  workoutName: string
  weekNumber: number
}): Promise<Session> {
  const open = await getInProgressSession(input.profileId)
  if (open) {
    if (open.workoutId === input.workoutId) return open
    await finishSession(open.id)
  }

  const now = Date.now()
  const session: Session = {
    id: newId(),
    profileId: input.profileId,
    planId: input.planId,
    workoutId: input.workoutId,
    workoutName: input.workoutName,
    weekNumber: input.weekNumber,
    startedAt: now,
    finishedAt: IN_PROGRESS,
    dateKey: toDateKey(now),
    groupModes: await inheritGroupModes(input.profileId, input.workoutId),
    warmupDone: [],
    notes: null,
  }
  await db.sessions.add(session)
  return session
}

/** O modo de execução de cada bi-set começa igual ao da última vez. */
async function inheritGroupModes(
  profileId: Id,
  workoutId: Id,
): Promise<Record<string, GroupMode>> {
  const previous = await db.sessions
    .where('[profileId+workoutId+startedAt]')
    .between([profileId, workoutId, Dexie.minKey], [profileId, workoutId, Dexie.maxKey])
    .last()
  return previous ? { ...previous.groupModes } : {}
}

export async function finishSession(id: Id): Promise<void> {
  await db.sessions.update(id, { finishedAt: Date.now() })
}

export async function reopenSession(id: Id): Promise<void> {
  await db.sessions.update(id, { finishedAt: IN_PROGRESS })
}

export async function setGroupMode(sessionId: Id, group: string, mode: GroupMode): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  await db.sessions.update(sessionId, {
    groupModes: { ...session.groupModes, [group]: mode },
  })
}

/** Marca/desmarca um exercício de preparação como feito (não gera SetLog). */
export async function toggleWarmupDone(sessionId: Id, exerciseId: Id): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  const done = new Set(session.warmupDone)
  if (done.has(exerciseId)) done.delete(exerciseId)
  else done.add(exerciseId)
  await db.sessions.update(sessionId, { warmupDone: [...done] })
}

export async function updateSessionNotes(sessionId: Id, notes: string | null): Promise<void> {
  await db.sessions.update(sessionId, { notes })
}

/** Descarta uma sessão e tudo que foi registrado nela. */
export async function deleteSessionCascade(sessionId: Id): Promise<void> {
  await db.transaction('rw', [db.sessions, db.setLogs], async () => {
    await db.setLogs.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}
