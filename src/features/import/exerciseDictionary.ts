import { deaccent } from '@/lib/text'

/**
 * Vocabulário de exercícios do plano, fornecido pelo usuário.
 *
 * Serve para encaixar o nome lido pelo OCR no nome real: "Pulleyfrente
 * supinado" vira "Pulley frente supinado", "Lombarno banco romano" vira
 * "Lombar no banco romano".
 *
 * As variações de grafia do próprio treinador ("Rosca scoth", "Puley frente",
 * "Abdômen supra") estão incluídas de propósito — elas aparecem no PDF e
 * ajudam o encaixe; a forma canônica é a primeira que casar.
 */
export const EXERCISE_DICTIONARY: string[] = [
  'Supino inclinado smith ou máquina',
  'Supino reto halteres',
  'Supino inclinado com halteres combinado com crucifixo inclinado com halteres',
  'Supino declinado',
  'Voador',
  'Rosca direta barra em pé',
  'Rosca scott na máquina ou no cross',
  'Rosca scoth na máquina ou no cross',
  'Rosca direta barra + rosca direta corda',
  'Rosca direta corda',
  'Agachamento Livre',
  'Leg 45º + agachamento frontal com halteres',
  'Leg 45º',
  'Hack Machine',
  'Cadeira Extensora',
  'Flexor deitado',
  'Flexor sentado',
  'Stiff',
  'Afundo smith com Step',
  'Elevação de quadril',
  'Elevação de quadril com barra costas apoiadas no banco',
  'Adutor + abdutor',
  'Adutor',
  'Abdutor',
  'Desenvolvimento sentado com halteres',
  'Elevação frontal corda',
  'Elevação lateral',
  'Elevação lateral + remada alta com barra',
  'Elevação lateral unilateral no cabo',
  'Tríceps testa com corda no banco 45',
  'Tríceps corda',
  'Tríceps francês sentado com halter + coice com halteres',
  'Tríceps francês sentado com corda',
  'Panturrilha em pé na máquina ou smith com Step',
  'Panturrilha sentada',
  'Remada curvada pronada',
  'Remada baixa pegada aberta',
  'Serrote',
  'Pulley frente aberto',
  'Pulley frente supinado',
  'Meio Terra',
  'Lombar no banco romano',
  'Abdominal supra na prancha',
  'Abdominal infra na torre',
]

function normalizar(valor: string): string {
  return deaccent(valor)
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const DICIONARIO_NORMALIZADO = EXERCISE_DICTIONARY.map((nome) => ({
  nome,
  chave: normalizar(nome),
  // Sem espaços: o OCR gruda palavras ("Pulleyfrente"), e comparar as duas
  // formas evita punir o candidato certo por causa disso.
  compacto: normalizar(nome).replace(/ /g, ''),
}))

function distancia(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo)
    }
    anterior = atual
  }
  return anterior[b.length]
}

const semelhanca = (a: string, b: string): number =>
  a.length === 0 && b.length === 0 ? 1 : 1 - distancia(a, b) / Math.max(a.length, b.length)

export interface NameMatch {
  name: string
  score: number
}

/**
 * Encaixa o nome lido no vocabulário, se houver candidato bom o bastante.
 *
 * O limiar é alto de propósito: trocar por um exercício parecido mas errado é
 * pior que deixar o nome torto, porque o nome torto o usuário percebe na
 * conferência e o nome errado passa despercebido.
 */
export function matchExerciseName(bruto: string, limiar = 0.68): NameMatch | null {
  const chave = normalizar(bruto)
  if (chave.length < 4) return null
  const compacto = chave.replace(/ /g, '')

  let melhor: NameMatch | null = null
  for (const item of DICIONARIO_NORMALIZADO) {
    const score = Math.max(semelhanca(chave, item.chave), semelhanca(compacto, item.compacto))
    if (!melhor || score > melhor.score) melhor = { name: item.nome, score }
  }

  return melhor && melhor.score >= limiar ? melhor : null
}
