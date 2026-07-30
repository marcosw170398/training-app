import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  Profile,
  ProfileState,
  SeriesTarget,
  Session,
  SessionPhoto,
  SetLog,
  TrainingPlan,
  Workout,
} from './schema'

/**
 * Sobre versionamento: no Dexie apenas o *esquema de índices* é versionado.
 * Acrescentar um campo NÃO indexado (ex.: `rpe` em SetLog) mais tarde não exige
 * `version(2)` — só mudanças de índice exigem.
 */
class TreinoDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  profileState!: EntityTable<ProfileState, 'profileId'>
  plans!: EntityTable<TrainingPlan, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  seriesTargets!: EntityTable<SeriesTarget, 'id'>
  sessions!: EntityTable<Session, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  sessionPhotos!: EntityTable<SessionPhoto, 'id'>

  constructor() {
    super('treino-app')

    this.version(1).stores({
      profiles: 'id, order',
      profileState: 'profileId',

      plans: 'id, profileId, [profileId+updatedAt]',

      // `weekNumber` nunca é null (NO_WEEK = 0 nos planos fixos), então o mesmo
      // índice serve planos fixos e periodizados.
      workouts:
        'id, planId, profileId, [planId+weekNumber+order], [planId+weekNumber+weekday]',

      exercises: 'id, workoutId, profileId, [workoutId+order], [profileId+exerciseKey]',

      seriesTargets: 'id, exerciseId, profileId, [exerciseId+seriesNumber]',

      // [profileId+finishedAt] localiza a sessão em andamento — por isso
      // `finishedAt` usa a sentinela 0 em vez de null.
      sessions:
        'id, profileId, workoutId, [profileId+startedAt], [profileId+finishedAt], [profileId+workoutId+startedAt]',

      // 1º índice: última carga daquele movimento/seção/série (pré-preenchimento).
      // 2º índice: série temporal do movimento (evolução).
      setLogs:
        'id, profileId, sessionId, exerciseId, ' +
        '[profileId+exerciseKey+section+seriesNumber+performedAt], ' +
        '[profileId+exerciseKey+section+performedAt], ' +
        '[sessionId+exerciseId]',
    })

    // v2: calendário de treinos e foto do dia.
    //
    // Só o esquema de índices sobe de versão. O Dexie preserva os dados das
    // stores existentes; `sessions` apenas ganha um índice novo.
    this.version(2).stores({
      // [profileId+dateKey] é o que o calendário consulta para pintar o mês.
      sessions:
        'id, profileId, workoutId, [profileId+startedAt], [profileId+finishedAt], ' +
        '[profileId+workoutId+startedAt], [profileId+dateKey]',

      sessionPhotos: 'id, profileId, sessionId, [profileId+dateKey]',
    })
  }
}

export const db = new TreinoDB()

/** Todas as tabelas com coluna `profileId` — usado por cascade e export. */
export const PROFILE_SCOPED_TABLES = [
  db.plans,
  db.workouts,
  db.exercises,
  db.seriesTargets,
  db.sessions,
  db.setLogs,
  db.sessionPhotos,
] as const
