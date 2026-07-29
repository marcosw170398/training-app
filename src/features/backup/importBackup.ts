import { db } from '@/db/db'
import {
  NO_WEEK,
  NO_WEEKDAY,
  type Exercise,
  type GroupMode,
  type Id,
  type PlanType,
  type Profile,
  type Section,
  type SeriesTarget,
  type Session,
  type SetLog,
  type TrainingPlan,
  type Workout,
} from '@/db/schema'
import { newId } from '@/lib/id'
import { deaccent } from '@/lib/text'
import { toExerciseKey } from '@/lib/exerciseKey'
import { toDateKey } from '@/lib/date'
import { parseWeekday } from '@/lib/weekday'
import { PROFILE_COLORS } from '@/db/repositories/profiles.repo'
import { backupFileSchema } from './backupFormat'

export type ImportMode =
  | { kind: 'newProfiles' }
  | { kind: 'merge'; profileId: Id }

export interface ImportResult {
  ok: boolean
  error?: string
  warnings: string[]
  counts: {
    profiles: number
    plans: number
    workouts: number
    exercises: number
    seriesTargets: number
    sessions: number
    setLogs: number
  }
}

const SECTION_ALIASES: Record<string, Section> = {
  aquecimento: 'warmup',
  preparacao: 'warmup',
  warmup: 'warmup',
  aproximacao: 'rampup',
  rampup: 'rampup',
  'ramp-up': 'rampup',
  principal: 'main',
  main: 'main',
  valendo: 'main',
}

function parseSection(value: string | null | undefined): Section {
  if (!value) return 'main'
  return SECTION_ALIASES[deaccent(value)] ?? 'main'
}

function parsePlanType(value: string | null | undefined): PlanType | null {
  if (!value) return null
  const norm = deaccent(value)
  if (norm === 'periodized' || norm === 'periodizado') return 'periodized'
  if (norm === 'fixed' || norm === 'fixo') return 'fixed'
  return null
}

function parseTimestamp(value: string | number | null | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

/**
 * Importa um backup do app OU um plano escrito à mão.
 *
 * Todos os ids do arquivo são REMAPEADOS para UUIDs novos. Sem isso, reimportar
 * o mesmo arquivo duas vezes sobrescreveria os registros da primeira vez em
 * silêncio — e um plano compartilhado entre dois celulares colidiria.
 */
export async function importBackup(raw: unknown, mode: ImportMode): Promise<ImportResult> {
  const empty = {
    profiles: 0,
    plans: 0,
    workouts: 0,
    exercises: 0,
    seriesTargets: 0,
    sessions: 0,
    setLogs: 0,
  }

  const parsed = backupFileSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      ok: false,
      error: `JSON fora do formato esperado${first ? `: ${first.path.join('.')} — ${first.message}` : ''}`,
      warnings: [],
      counts: empty,
    }
  }

  const file = parsed.data
  const warnings: string[] = []
  const now = Date.now()

  const rawPlans = file.plans ?? file.trainingPlans ?? []
  const rawWorkouts = file.workouts ?? []
  const rawExercises = file.exercises ?? []
  const rawSeries = file.seriesTargets ?? []
  const rawSessions = file.sessions ?? []
  const rawSetLogs = file.setLogs ?? []

  if (rawPlans.length === 0) {
    return { ok: false, error: 'Nenhum plano encontrado no arquivo.', warnings, counts: empty }
  }

  // --- perfis -------------------------------------------------------------
  const profileIdMap = new Map<string, Id>()
  const newProfiles: Profile[] = []

  if (mode.kind === 'merge') {
    for (const profile of file.profiles ?? []) profileIdMap.set(profile.id, mode.profileId)
  } else {
    const existingCount = await db.profiles.count()
    ;(file.profiles ?? []).forEach((profile, index) => {
      const id = newId()
      profileIdMap.set(profile.id, id)
      newProfiles.push({
        id,
        name: profile.name.trim() || `Perfil ${existingCount + index + 1}`,
        color: profile.color ?? PROFILE_COLORS[(existingCount + index) % PROFILE_COLORS.length],
        order: existingCount + index,
        createdAt: parseTimestamp(profile.createdAt, now),
      })
    })
  }

  const fallbackProfileId =
    mode.kind === 'merge' ? mode.profileId : (newProfiles[0]?.id ?? null)

  if (!fallbackProfileId) {
    return {
      ok: false,
      error: 'O arquivo não traz perfis. Importe mesclando em um perfil existente.',
      warnings,
      counts: empty,
    }
  }

  const resolveProfile = (id: string | null | undefined): Id =>
    (id ? profileIdMap.get(id) : undefined) ?? fallbackProfileId

  // --- planos -------------------------------------------------------------
  const planIdMap = new Map<string, Id>()
  const plans: TrainingPlan[] = []

  for (const rawPlan of rawPlans) {
    const id = newId()
    planIdMap.set(rawPlan.id, id)

    const workoutsOfPlan = rawWorkouts.filter(
      (workout) => (workout.planId ?? workout.trainingPlanId) === rawPlan.id,
    )
    const weekNumbers = workoutsOfPlan
      .map((workout) => workout.weekNumber ?? 0)
      .filter((week) => week > 0)

    // Tipo ausente é inferido pela presença de semanas numeradas.
    const type = parsePlanType(rawPlan.type) ?? (weekNumbers.length ? 'periodized' : 'fixed')
    const totalWeeks =
      type === 'periodized'
        ? Math.max(rawPlan.totalWeeks ?? 0, weekNumbers.length ? Math.max(...weekNumbers) : 1)
        : 0

    plans.push({
      id,
      profileId: resolveProfile(rawPlan.profileId),
      name: rawPlan.name.trim(),
      type,
      totalWeeks,
      notes: rawPlan.notes ?? null,
      createdAt: parseTimestamp(rawPlan.createdAt, now),
      updatedAt: parseTimestamp(rawPlan.updatedAt ?? rawPlan.createdAt, now),
    })
  }

  // --- treinos ------------------------------------------------------------
  const workoutIdMap = new Map<string, Id>()
  const workouts: Workout[] = []
  const orderCursor = new Map<string, number>()

  for (const rawWorkout of rawWorkouts) {
    const sourcePlanId = rawWorkout.planId ?? rawWorkout.trainingPlanId
    const planId = sourcePlanId ? planIdMap.get(sourcePlanId) : undefined
    if (!planId) {
      warnings.push(`Treino "${rawWorkout.name}" ignorado: plano não encontrado no arquivo.`)
      continue
    }

    const plan = plans.find((item) => item.id === planId)!
    // weekNumber nulo vira NO_WEEK (0): null não é indexável no IndexedDB.
    const weekNumber = plan.type === 'periodized' ? (rawWorkout.weekNumber ?? 1) : NO_WEEK
    const weekday =
      typeof rawWorkout.weekday === 'number'
        ? rawWorkout.weekday
        : parseWeekday(rawWorkout.weekday ?? null)

    const cursorKey = `${planId}|${weekNumber}`
    const nextOrder = orderCursor.get(cursorKey) ?? 0
    orderCursor.set(cursorKey, nextOrder + 1)

    const id = newId()
    workoutIdMap.set(rawWorkout.id, id)
    workouts.push({
      id,
      profileId: plan.profileId,
      planId,
      name: rawWorkout.name.trim(),
      weekNumber,
      weekday: weekday || NO_WEEKDAY,
      order: rawWorkout.order ?? nextOrder,
      notes: rawWorkout.notes ?? null,
    })
  }

  // --- exercícios ---------------------------------------------------------
  const exerciseIdMap = new Map<string, Id>()
  const exercises: Exercise[] = []
  const exerciseOrder = new Map<string, number>()

  for (const rawExercise of rawExercises) {
    const workoutId = workoutIdMap.get(rawExercise.workoutId)
    if (!workoutId) {
      warnings.push(`Exercício "${rawExercise.name}" ignorado: treino não encontrado.`)
      continue
    }
    const workout = workouts.find((item) => item.id === workoutId)!
    const nextOrder = exerciseOrder.get(workoutId) ?? 0
    exerciseOrder.set(workoutId, nextOrder + 1)

    const id = newId()
    exerciseIdMap.set(rawExercise.id, id)
    exercises.push({
      id,
      profileId: workout.profileId,
      workoutId,
      name: rawExercise.name.trim(),
      exerciseKey: toExerciseKey(rawExercise.name),
      section: parseSection(rawExercise.section),
      technique: rawExercise.technique ?? null,
      supersetGroup: rawExercise.supersetGroup ?? null,
      order: rawExercise.order ?? nextOrder,
      notes: rawExercise.notes ?? null,
    })
  }

  // --- séries -------------------------------------------------------------
  const seriesIdMap = new Map<string, Id>()
  const seriesTargets: SeriesTarget[] = []
  const seriesCursor = new Map<string, number>()

  for (const rawTarget of rawSeries) {
    const exerciseId = exerciseIdMap.get(rawTarget.exerciseId)
    if (!exerciseId) continue
    const exercise = exercises.find((item) => item.id === exerciseId)!
    const nextNumber = (seriesCursor.get(exerciseId) ?? 0) + 1
    seriesCursor.set(exerciseId, nextNumber)

    const id = newId()
    seriesIdMap.set(rawTarget.id, id)
    seriesTargets.push({
      id,
      profileId: exercise.profileId,
      exerciseId,
      seriesNumber: rawTarget.seriesNumber ?? nextNumber,
      targetText: rawTarget.targetText ?? '',
      restSecondsMin: rawTarget.restSecondsMin ?? null,
      restSecondsMax: rawTarget.restSecondsMax ?? null,
      restNote: rawTarget.restNote ?? null,
    })
  }

  // --- sessões e histórico ------------------------------------------------
  const sessionIdMap = new Map<string, Id>()
  const sessions: Session[] = []

  for (const rawSession of rawSessions) {
    const workoutId = rawSession.workoutId ? workoutIdMap.get(rawSession.workoutId) : undefined
    const planId = rawSession.planId ? planIdMap.get(rawSession.planId) : undefined
    const startedAt = rawSession.startedAt ?? now
    const id = newId()
    sessionIdMap.set(rawSession.id, id)

    const groupModes: Record<string, GroupMode> = {}
    for (const [group, value] of Object.entries(rawSession.groupModes ?? {})) {
      groupModes[group] = value === 'separate' ? 'separate' : 'paired'
    }

    sessions.push({
      id,
      profileId: resolveProfile(rawSession.profileId),
      planId: planId ?? '',
      workoutId: workoutId ?? '',
      workoutName: rawSession.workoutName ?? 'Treino',
      weekNumber: rawSession.weekNumber ?? NO_WEEK,
      startedAt,
      // Sessão importada nunca entra como "em andamento" (IN_PROGRESS = 0):
      // isso ocuparia o slot de treino aberto do perfil.
      finishedAt: rawSession.finishedAt || startedAt,
      dateKey: rawSession.dateKey ?? toDateKey(startedAt),
      groupModes,
      warmupDone: (rawSession.warmupDone ?? [])
        .map((exerciseId) => exerciseIdMap.get(exerciseId))
        .filter((value): value is Id => Boolean(value)),
      notes: rawSession.notes ?? null,
    })
  }

  const setLogs: SetLog[] = []
  for (const rawLog of rawSetLogs) {
    const exerciseId = rawLog.exerciseId ? exerciseIdMap.get(rawLog.exerciseId) : undefined
    const exercise = exerciseId ? exercises.find((item) => item.id === exerciseId) : undefined
    const name = rawLog.exerciseName ?? exercise?.name
    const key = rawLog.exerciseKey ?? (name ? toExerciseKey(name) : null)

    if (!key || !name) {
      warnings.push('Um registro de série foi ignorado: exercício não identificado.')
      continue
    }

    const performedAt = rawLog.performedAt ?? (rawLog.dateKey ? Date.parse(rawLog.dateKey) : now)
    setLogs.push({
      id: newId(),
      profileId: resolveProfile(rawLog.profileId),
      sessionId: (rawLog.sessionId ? sessionIdMap.get(rawLog.sessionId) : undefined) ?? '',
      exerciseId: exerciseId ?? '',
      exerciseKey: key,
      exerciseName: name,
      section: parseSection(rawLog.section ?? exercise?.section),
      seriesTargetId: (rawLog.seriesTargetId ? seriesIdMap.get(rawLog.seriesTargetId) : null) ?? null,
      seriesNumber: rawLog.seriesNumber ?? 1,
      targetText: rawLog.targetText ?? '',
      weight: rawLog.weight ?? null,
      weightUnit: 'kg',
      reps: rawLog.reps ?? null,
      durationSeconds: rawLog.durationSeconds ?? null,
      performedAt: Number.isNaN(performedAt) ? now : performedAt,
      dateKey: rawLog.dateKey ?? toDateKey(Number.isNaN(performedAt) ? now : performedAt),
      notes: rawLog.notes ?? null,
    })
  }

  // --- escrita ------------------------------------------------------------
  await db.transaction(
    'rw',
    [
      db.profiles,
      db.profileState,
      db.plans,
      db.workouts,
      db.exercises,
      db.seriesTargets,
      db.sessions,
      db.setLogs,
    ],
    async () => {
      if (newProfiles.length) {
        await db.profiles.bulkAdd(newProfiles)
        await db.profileState.bulkAdd(
          newProfiles.map((profile) => ({
            profileId: profile.id,
            activePlanId: null,
            currentWeekNumber: NO_WEEK,
            weekStartedAt: null,
            restDefaultsToMax: false,
            soundEnabled: true,
            vibrationEnabled: true,
            keepScreenAwake: true,
            tutorialSeenAt: null,
          })),
        )
      }
      if (plans.length) await db.plans.bulkAdd(plans)
      if (workouts.length) await db.workouts.bulkAdd(workouts)
      if (exercises.length) await db.exercises.bulkAdd(exercises)
      if (seriesTargets.length) await db.seriesTargets.bulkAdd(seriesTargets)
      if (sessions.length) await db.sessions.bulkAdd(sessions)
      if (setLogs.length) await db.setLogs.bulkAdd(setLogs)
    },
  )

  return {
    ok: true,
    warnings,
    counts: {
      profiles: newProfiles.length,
      plans: plans.length,
      workouts: workouts.length,
      exercises: exercises.length,
      seriesTargets: seriesTargets.length,
      sessions: sessions.length,
      setLogs: setLogs.length,
    },
  }
}
