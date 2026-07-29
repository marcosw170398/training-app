import { deaccent } from './text'

/**
 * Normaliza o nome do exercício numa chave estável de evolução.
 *
 * "Supino inclinado smith ou máquina" -> "supino-inclinado-smith-ou-maquina"
 *
 * É essa chave — e não o `id` do exercício — que liga o mesmo movimento entre
 * semanas diferentes de um plano periodizado e entre planos distintos.
 */
export function toExerciseKey(name: string): string {
  return deaccent(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
