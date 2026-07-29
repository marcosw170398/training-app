import { z } from 'zod'

/**
 * Formato de intercâmbio do app.
 *
 * O schema é DELIBERADAMENTE tolerante: ele precisa aceitar tanto o export do
 * próprio app quanto um JSON escrito à mão (como o `exemplo-planos.json`), que
 * usa `trainingPlans`/`trainingPlanId`, `weekday: "segunda"`, `weekNumber: null`
 * e `section: "aquecimento" | "principal"`.
 *
 * É esse mesmo caminho que o parser de PDF vai usar no futuro: ele produzirá
 * este JSON e reaproveitará a importação inteira, sem código novo de escrita.
 */

const looseDate = z.union([z.string(), z.number()]).nullish()

export const backupProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullish(),
  order: z.number().nullish(),
  createdAt: looseDate,
})

export const backupPlanSchema = z.object({
  id: z.string(),
  profileId: z.string().nullish(),
  name: z.string(),
  type: z.string().nullish(),
  totalWeeks: z.number().nullish(),
  notes: z.string().nullish(),
  createdAt: looseDate,
  updatedAt: looseDate,
})

export const backupWorkoutSchema = z.object({
  id: z.string(),
  // O app exporta `planId`; o JSON de exemplo usa `trainingPlanId`.
  planId: z.string().nullish(),
  trainingPlanId: z.string().nullish(),
  name: z.string(),
  weekNumber: z.number().nullish(),
  weekday: z.union([z.string(), z.number()]).nullish(),
  order: z.number().nullish(),
  notes: z.string().nullish(),
})

export const backupExerciseSchema = z.object({
  id: z.string(),
  workoutId: z.string(),
  name: z.string(),
  section: z.string().nullish(),
  technique: z.string().nullish(),
  supersetGroup: z.string().nullish(),
  order: z.number().nullish(),
  notes: z.string().nullish(),
})

export const backupSeriesSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  seriesNumber: z.number().nullish(),
  targetText: z.string().nullish(),
  restSecondsMin: z.number().nullish(),
  restSecondsMax: z.number().nullish(),
  restNote: z.string().nullish(),
})

export const backupSessionSchema = z.object({
  id: z.string(),
  profileId: z.string().nullish(),
  planId: z.string().nullish(),
  workoutId: z.string().nullish(),
  workoutName: z.string().nullish(),
  weekNumber: z.number().nullish(),
  startedAt: z.number().nullish(),
  finishedAt: z.number().nullish(),
  dateKey: z.string().nullish(),
  groupModes: z.record(z.string(), z.string()).nullish(),
  warmupDone: z.array(z.string()).nullish(),
  notes: z.string().nullish(),
})

export const backupSetLogSchema = z.object({
  id: z.string(),
  profileId: z.string().nullish(),
  sessionId: z.string().nullish(),
  exerciseId: z.string().nullish(),
  exerciseKey: z.string().nullish(),
  exerciseName: z.string().nullish(),
  section: z.string().nullish(),
  seriesTargetId: z.string().nullish(),
  seriesNumber: z.number().nullish(),
  targetText: z.string().nullish(),
  weight: z.number().nullish(),
  reps: z.number().nullish(),
  durationSeconds: z.number().nullish(),
  performedAt: z.number().nullish(),
  dateKey: z.string().nullish(),
  notes: z.string().nullish(),
})

export const backupFileSchema = z.object({
  schemaVersion: z.number().nullish(),
  exportedAt: z.string().nullish(),
  profiles: z.array(backupProfileSchema).nullish(),
  plans: z.array(backupPlanSchema).nullish(),
  trainingPlans: z.array(backupPlanSchema).nullish(),
  workouts: z.array(backupWorkoutSchema).nullish(),
  exercises: z.array(backupExerciseSchema).nullish(),
  seriesTargets: z.array(backupSeriesSchema).nullish(),
  sessions: z.array(backupSessionSchema).nullish(),
  setLogs: z.array(backupSetLogSchema).nullish(),
})

export type BackupFile = z.infer<typeof backupFileSchema>

export const BACKUP_SCHEMA_VERSION = 1
