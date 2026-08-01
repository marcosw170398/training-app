/**
 * 1RM estimado pela fórmula de Epley: peso × (1 + reps/30).
 *
 * Só confiável em faixas de repetição baixas/moderadas — além de ~12 reps o
 * erro de estimativa cresce demais para servir de referência de carga.
 */
export function epley1RM(weight: number, reps: number): number | null {
  if (reps < 1 || reps > 12) return null
  return weight * (1 + reps / 30)
}

/** Maior 1RM estimado entre uma lista de séries (peso, reps). */
export function bestEstimated1RM(sets: { weight: number | null; reps: number | null }[]): number | null {
  let melhor: number | null = null
  for (const { weight, reps } of sets) {
    if (weight === null || reps === null) continue
    const estimado = epley1RM(weight, reps)
    if (estimado !== null && (melhor === null || estimado > melhor)) melhor = estimado
  }
  return melhor
}
