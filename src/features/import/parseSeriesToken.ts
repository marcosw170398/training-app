/**
 * Interpreta a notação de série do plano em cartões: `(1x15 a 20)`.
 *
 * Lê-se "1 série de 15 a 20 repetições" — o número antes do `x` é a QUANTIDADE
 * de séries, então `(3x 8 a 12)` vira três séries iguais.
 */
export interface SeriesToken {
  /** Quantas séries este token representa. */
  count: number
  /** Alvo já normalizado: "15-20". */
  target: string
  /** Sufixo livre depois da faixa: "+ 2 drop", "+ strip set …". */
  suffix: string
}

/**
 * Conserta confusões clássicas do OCR DENTRO da parte numérica.
 *
 * O `l`/`I` maiúsculo vira 1 e o `O` vira 0 — é o que transforma o `(Ix6alo)`
 * lido pelo tesseract no `(1x6 a 10)` do plano. A correção fica restrita ao
 * trecho dos números: aplicá-la ao sufixo transformaria "drop" em "dr0p".
 */
function repararNumeros(trecho: string): string {
  return trecho.replace(/[IlD|]/g, '1').replace(/[OoQ]/g, '0')
}

/**
 * Recupera uma faixa cujo separador virou dígito no OCR.
 *
 * "10315" -> "10-15" · "8312" -> "8-12" · "15220" -> "15-20"
 *
 * Só aceita a divisão em que os dois lados são repetições plausíveis e
 * crescentes — o que torna a correção verificável em vez de chute.
 */
function repararFaixaColada(numero: string): string | null {
  for (let i = 1; i < numero.length - 1; i++) {
    const esquerda = Number(numero.slice(0, i))
    const direita = Number(numero.slice(i + 1))
    if (esquerda >= 1 && esquerda <= 30 && direita > esquerda && direita <= 30) {
      return `${esquerda}-${direita}`
    }
  }
  return null
}

const RE_TOKEN = /\(([^)]{2,90})\)/g

export function parseSeriesTokens(linha: string): SeriesToken[] {
  const tokens: SeriesToken[] = []

  for (const match of linha.matchAll(RE_TOKEN)) {
    const bruto = match[1]

    // Separa "3x 8 a 12" do que vier depois de um "+".
    const maisIndex = bruto.search(/\+/)
    const parteNumerica = maisIndex >= 0 ? bruto.slice(0, maisIndex) : bruto
    const suffix = maisIndex >= 0 ? bruto.slice(maisIndex).replace(/\s+/g, ' ').trim() : ''

    const reparado = repararNumeros(parteNumerica)

    // "3x 8 a 12" | "1x15a20" | "3x8-12"
    const faixa = reparado.match(/(\d+)\s*[xX×]\s*(\d+)\s*(?:a|à|-|–|até)\s*(\d+)/)
    if (faixa) {
      const [, quantidade, minimo, maximo] = faixa
      tokens.push({
        count: Math.min(10, Math.max(1, Number(quantidade))),
        target: `${Number(minimo)}-${Number(maximo)}`,
        suffix,
      })
      continue
    }

    // "3x 12" — sem faixa, repetição fixa.
    const fixa = reparado.match(/(\d+)\s*[xX×]\s*(\d+)\s*$/)
    if (fixa) {
      const count = Math.min(10, Math.max(1, Number(fixa[1])))
      const numero = fixa[2]
      // Repetição absurda quase sempre é faixa colada: o OCR leu o "a" de
      // "10 a 15" como dígito e produziu "10315".
      const faixaRecuperada = Number(numero) > 30 ? repararFaixaColada(numero) : null
      tokens.push({ count, target: faixaRecuperada ?? `${Number(numero)}`, suffix })
      continue
    }

    // "(até a falha)", "(100 reps)" — texto livre, uma série.
    const texto = bruto.replace(/\s+/g, ' ').trim()
    if (/\d/.test(texto) || /falha|reps|segundos|minutos/i.test(texto)) {
      tokens.push({ count: 1, target: texto, suffix: '' })
    }
  }

  return tokens
}

/** Limpa o texto do intervalo antes de interpretá-lo. */
export function limparIntervalo(linha: string): string {
  return linha
    .replace(/^.*?intervalo\s*:?/i, '')
    .replace(/entre\s+as\s+s[ée]ries?\.?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}
