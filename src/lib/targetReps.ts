/**
 * Repetições sugeridas a partir do alvo prescrito.
 *
 * Numa faixa, o topo é o valor sugerido — é a meta da série. Quando o alvo é um
 * número só, ele mesmo:
 *
 *   "8-12"      -> 12
 *   "15 a 20"   -> 20
 *   "15"        -> 15
 *   "100 reps"  -> 100
 *
 * Devolve `null` quando o alvo não descreve repetições, e nesses casos o campo
 * fica vazio em vez de receber um chute:
 *
 *   "até a falha"        -> null
 *   "2 antes de falhar"  -> null  (o 2 não é a quantidade de repetições)
 *   "5 minutos"          -> null  (é duração)
 */
export function repsFromTarget(targetText: string | null | undefined): number | null {
  const texto = (targetText ?? '').trim()
  if (!texto) return null

  // Faixa: "8-12", "15 a 20", "6-10 + 2 drop" (o sufixo não atrapalha).
  const faixa = texto.match(/(\d+)\s*(?:-|–|—|a|até)\s*(\d+)/i)
  if (faixa) {
    const inicio = Number(faixa[1])
    const fim = Number(faixa[2])
    if (fim >= inicio) return fim
  }

  // Valor exato: só quando o texto é o número sozinho, opcionalmente seguido de
  // "reps". Exigir isso é o que impede "5 minutos" e "2 antes de falhar" de
  // virarem repetições.
  const exato = texto.match(/^(\d+)\s*(?:reps?|repeti[çc][õo]es|x)?$/i)
  if (exato) return Number(exato[1])

  return null
}
