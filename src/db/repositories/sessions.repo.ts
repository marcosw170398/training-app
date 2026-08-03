import Dexie from 'dexie'
import { db } from '../db'
import { IN_PROGRESS, type GroupMode, type Id, type Session } from '../schema'
import { newId } from '@/lib/id'
import { mondayOfWeek, toDateKey } from '@/lib/date'

const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000
const MAX_DURATION_MS = 4 * 60 * 60 * 1000

/** Instante em que uma sessão esquecida deveria ter sido encerrada, se for o caso. */
async function staleCutoff(session: Session): Promise<number | null> {
  const logs = await db.setLogs.where('sessionId').equals(session.id).toArray()
  const lastActivity = logs.length ? Math.max(...logs.map((log) => log.performedAt)) : session.startedAt
  const idleCutoff = lastActivity + IDLE_LIMIT_MS
  const durationCutoff = session.startedAt + MAX_DURATION_MS
  const cutoff = Math.min(idleCutoff, durationCutoff)
  return Date.now() > cutoff ? cutoff : null
}

/**
 * Sessão ainda aberta do perfil, se houver. É o que permite retomar um treino
 * interrompido (bateria acabou, saiu da academia e voltou) em vez de deixar
 * SetLogs órfãos soltos no histórico.
 *
 * Uma sessão esquecida (2h sem nenhuma série registrada, ou 4h de duração
 * total) já é tratada como encerrada aqui — só a LEITURA, sem gravar nada.
 * `useLiveQuery` proíbe escrita dentro da própria query reativa; quem quiser
 * de fato encerrar a sessão travada no banco chama `reapStaleSession`
 * separadamente (fora do contexto do liveQuery).
 */
export async function getInProgressSession(profileId: Id): Promise<Session | undefined> {
  const open = await db.sessions.where('[profileId+finishedAt]').equals([profileId, IN_PROGRESS]).first()
  if (!open) return undefined
  if (await staleCutoff(open)) return undefined
  return open
}

/**
 * Encerra de fato, no banco, uma sessão esquecida do perfil — chamar fora de
 * `useLiveQuery` (ex.: um `useEffect` comum no layout). Encerra no instante
 * do corte (2h de ociosidade ou 4h de duração), não em "agora" — senão o
 * treino aparece no histórico com uma duração absurda (o tempo até alguém
 * reabrir o app).
 */
export async function reapStaleSession(profileId: Id): Promise<void> {
  const open = await db.sessions.where('[profileId+finishedAt]').equals([profileId, IN_PROGRESS]).first()
  if (!open) return
  const cutoff = await staleCutoff(open)
  if (cutoff !== null) await db.sessions.update(open.id, { finishedAt: cutoff })
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

/** Sessões de um intervalo de dias — alimenta o calendário. */
export function listSessionsBetween(
  profileId: Id,
  fromDateKey: string,
  toDateKey: string,
): Promise<Session[]> {
  return db.sessions
    .where('[profileId+dateKey]')
    .between([profileId, fromDateKey], [profileId, toDateKey], true, true)
    .toArray()
}

/**
 * Semanas seguidas (segunda a domingo) com pelo menos um treino, contadas
 * para trás a partir da semana mais recente que teve treino — não da semana
 * corrente. Semana sem treino é normal num programa de força (descanso), não
 * deveria zerar a sequência se a pessoa simplesmente ainda não treinou hoje.
 */
export async function currentWeekStreak(profileId: Id): Promise<number> {
  const sessions = await db.sessions.where('profileId').equals(profileId).toArray()
  if (!sessions.length) return 0

  const semanas = new Set(sessions.map((session) => mondayOfWeek(session.dateKey)))
  const maisRecente = [...semanas].sort().at(-1)!

  let streak = 0
  let cursor = new Date(`${maisRecente}T12:00`)
  while (semanas.has(toDateKey(cursor.getTime()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
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
