import type { PlanType, Section } from '@/db/schema'

/**
 * Resultado do parsing, ANTES de virar registro no banco.
 *
 * Nada disso é gravado direto: a tela de conferência recebe esta estrutura, o
 * usuário corrige, e só então ela é convertida em Plan/Workout/Exercise/Series.
 * Um parser errando calado significa carga errada na academia.
 */
export interface ParsedSeries {
  seriesNumber: number
  targetText: string
  restSecondsMin: number | null
  restSecondsMax: number | null
  restNote: string | null
}

export interface ParsedExercise {
  name: string
  section: Section
  technique: string | null
  series: ParsedSeries[]
  /** 0..1 — herda a confiança do OCR; 1 quando veio da camada de texto. */
  confidence: number
}

export interface ParsedWorkout {
  name: string
  weekNumber: number
  weekday: number
  exercises: ParsedExercise[]
}

export interface ParsedPlan {
  name: string
  type: PlanType
  totalWeeks: number
  workouts: ParsedWorkout[]
  warnings: string[]
  source: 'text' | 'ocr'
}

export function countExercises(plan: ParsedPlan): number {
  return plan.workouts.reduce((total, workout) => total + workout.exercises.length, 0)
}

export function countSeries(plan: ParsedPlan): number {
  return plan.workouts.reduce(
    (total, workout) =>
      total + workout.exercises.reduce((sum, exercise) => sum + exercise.series.length, 0),
    0,
  )
}
