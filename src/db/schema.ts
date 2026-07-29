/**
 * Entidades persistidas no IndexedDB (via Dexie).
 *
 * Duas restrições do IndexedDB moldam este schema e explicam as sentinelas
 * numéricas espalhadas abaixo:
 *
 * 1. `null`/`undefined` NÃO são indexáveis. Um registro com `weekNumber: null`
 *    desaparece de um índice sobre `weekNumber`, e um índice composto
 *    `[planId+weekNumber+order]` ignora a linha inteira se qualquer parte for
 *    nula. Por isso plano fixo usa `weekNumber: 0` e sessão em andamento usa
 *    `finishedAt: 0` — nunca `null`.
 * 2. Booleanos não são indexáveis. Por isso não existe `plan.isActive`; o plano
 *    ativo mora em `ProfileState.activePlanId`.
 *
 * Campos que nunca entram em índice (`technique`, `restNote`, `notes`, ...)
 * podem ser `null` à vontade.
 */

export type Id = string

/** Sentinela de "sem semana" — usada por planos fixos. */
export const NO_WEEK = 0
/** Sentinela de "sem dia da semana definido". */
export const NO_WEEKDAY = 0
/** Sentinela de sessão ainda em andamento (`finishedAt`). */
export const IN_PROGRESS = 0

/**
 * Seção do exercício dentro do treino.
 * - `warmup`  — preparação geral (elíptico, mobilidade). NÃO gera SetLog.
 * - `rampup`  — aproximação do exercício. Gera SetLog (a carga serve de
 *               referência), mas fica FORA dos gráficos de evolução.
 * - `main`    — série valendo. Gera SetLog e alimenta a evolução.
 */
export type Section = 'warmup' | 'rampup' | 'main'

export const SECTIONS: Section[] = ['warmup', 'rampup', 'main']

export const SECTION_LABEL: Record<Section, string> = {
  warmup: 'Preparação',
  rampup: 'Aproximação',
  main: 'Principal',
}

export const SECTION_HINT: Record<Section, string> = {
  warmup: 'Aquecimento geral — não registra carga.',
  rampup: 'Série de aproximação — registra carga, fora da evolução.',
  main: 'Série valendo — registra carga e alimenta a evolução.',
}

/** Seções cujas séries geram SetLog. */
export const LOGGED_SECTIONS: Section[] = ['rampup', 'main']

export function isLogged(section: Section): boolean {
  return section !== 'warmup'
}

export type PlanType = 'fixed' | 'periodized'

/** Como um grupo (bi-set/tri-set) foi de fato executado numa sessão. */
export type GroupMode = 'paired' | 'separate'

export interface Profile {
  id: Id
  name: string
  /** Cor hex, usada como avatar e acento da UI. */
  color: string
  order: number
  createdAt: number
}

/** Uma linha por perfil. Estado de navegação e preferências. */
export interface ProfileState {
  profileId: Id
  activePlanId: Id | null
  /** 0 para plano fixo; 1..totalWeeks para periodizado. */
  currentWeekNumber: number
  /** Quando a semana atual começou — alimenta a sugestão de avançar. */
  weekStartedAt: number | null
  /** Cronômetro usa restSecondsMax em vez de restSecondsMin. */
  restDefaultsToMax: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
  keepScreenAwake: boolean
  /**
   * Quando este perfil viu o tutorial. `null` = nunca viu.
   *
   * Fica no perfil, não no dispositivo: o celular é compartilhado, então a
   * segunda pessoa a usar o app precisa ver a introdução na primeira vez dela.
   */
  tutorialSeenAt: number | null
}

export interface TrainingPlan {
  id: Id
  profileId: Id
  name: string
  /** Só orienta a UI — o schema é o mesmo para os dois tipos. */
  type: PlanType
  /** 0 quando `type === 'fixed'`. */
  totalWeeks: number
  notes: string | null
  createdAt: number
  updatedAt: number
}

export interface Workout {
  id: Id
  profileId: Id
  planId: Id
  /** "Treino A" (fixo) ou "Segunda-feira" (periodizado). */
  name: string
  /** NO_WEEK para plano fixo; 1..N para periodizado. */
  weekNumber: number
  /** NO_WEEKDAY, ou 1 = segunda ... 7 = domingo. */
  weekday: number
  order: number
  notes: string | null
}

export interface Exercise {
  id: Id
  profileId: Id
  workoutId: Id
  name: string
  /**
   * Slug normalizado do nome. É o que liga o MESMO movimento entre semanas e
   * entre planos — sem ele, "Supino máquina" da Semana 01 e o da Semana 04
   * seriam exercícios sem relação e a progressão do ciclo ficaria invisível.
   */
  exerciseKey: string
  section: Section
  /** Texto livre: "bi-set", "FST-7", "pico de contração de 2s". */
  technique: string | null
  /**
   * Rótulo do agrupamento (bi-set/tri-set). Exercícios do mesmo treino que
   * compartilham o rótulo são exibidos num card único durante a execução.
   */
  supersetGroup: string | null
  order: number
  notes: string | null
}

export interface SeriesTarget {
  id: Id
  profileId: Id
  exerciseId: Id
  seriesNumber: number
  /** Texto livre: "8-12", "até a falha", "100 reps", "2 antes de falhar". */
  targetText: string
  restSecondsMin: number | null
  restSecondsMax: number | null
  /** Texto livre para descanso não-cronometrável ("um lado após o outro"). */
  restNote: string | null
}

/** Uma execução de treino. Agrupa SetLogs e permite retomar treino interrompido. */
export interface Session {
  id: Id
  profileId: Id
  planId: Id
  workoutId: Id
  /** Snapshot — sobrevive a rename/remoção do treino. */
  workoutName: string
  weekNumber: number
  startedAt: number
  /** IN_PROGRESS (0) enquanto não encerrada. */
  finishedAt: number
  /** "YYYY-MM-DD" local. */
  dateKey: string
  /** Como cada grupo de bi-set foi executado nesta sessão. */
  groupModes: Record<string, GroupMode>
  /** Ids de exercícios `warmup` marcados como feitos (não geram SetLog). */
  warmupDone: Id[]
  notes: string | null
}

/** Registro real de uma série executada. Imutável por construção. */
export interface SetLog {
  id: Id
  profileId: Id
  sessionId: Id
  exerciseId: Id
  exerciseKey: string
  /** Snapshot do nome — o histórico sobrevive a rename/remoção do exercício. */
  exerciseName: string
  section: Section
  /** null quando é série extra, além do prescrito. */
  seriesTargetId: Id | null
  seriesNumber: number
  /** Snapshot do alvo prescrito ("8-12", "até a falha"). */
  targetText: string
  /** null = sem carga (peso corporal, elástico, cardio). */
  weight: number | null
  weightUnit: 'kg'
  reps: number | null
  /** Para isometria e cardio ("5 minutos", "30s"). */
  durationSeconds: number | null
  performedAt: number
  dateKey: string
  notes: string | null
}
