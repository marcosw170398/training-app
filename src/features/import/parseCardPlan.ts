import { NO_WEEK, NO_WEEKDAY, type Section } from '@/db/schema'
import { deaccent } from '@/lib/text'
import type { PositionedPage } from './positioned'
import { toLines } from './table'
import { parseRest } from './parseRest'
import { limparIntervalo, parseSeriesTokens } from './parseSeriesToken'
import { matchExerciseName } from './exerciseDictionary'
import type { ParsedExercise, ParsedPlan, ParsedSeries, ParsedWorkout } from './parsedPlan'

/**
 * Parser do layout em cartões (o plano "Além da Genética"), onde cada
 * exercício é um bloco:
 *
 *     Supino inclinado smith ou máquina      <- nome
 *     Progressão de carga e strip set …      <- descrição/técnica
 *     Intervalo: 2 a 3 minutos entre as séries.
 *     (1x15 a 20)  (1x10 a 15)  (1x 8 a 12)  <- séries
 *
 * Diferente do plano em tabela, aqui não há colunas: a âncora é a linha
 * "Intervalo:", que sobrevive bem ao OCR mesmo quando o resto degrada.
 */

/**
 * Dois-pontos OPCIONAL: o plano alterna entre "Intervalo: 45 segundos" e
 * "Intervalo 1 a 2 minutos". Exigir o `:` fazia o segundo caso virar descrição
 * e o exercício ficar sem descanso.
 */
const RE_INTERVALO = /intervalo\s*:?\s*\d/i
const RE_TREINO = /^treino\s*([a-h])$/i
const RE_TEM_SERIE = /\(\s*\d+\s*[xX×]/

/**
 * Remove o lixo que o OCR gruda nas pontas da linha.
 *
 * Os marcadores hexagonais do layout viram tokens curtos aleatórios ("Rs", "6",
 * "$", "en"), e eles entrariam no nome do exercício se não fossem descartados.
 */
function limparRuido(texto: string): string {
  const tokens = texto.split(/\s+/).filter(Boolean)

  const ehLixo = (token: string, ponta: 'inicio' | 'fim') => {
    if (token.length > 3) return false
    // Dígito ou parêntese é conteúdo: "(3x", "8a", "12)" são pedaços da série.
    // Sem esta guarda, a limpeza comia a própria notação de repetições e o
    // exercício ficava sem séries.
    if (/[()\d]/.test(token)) {
      // A única exceção é o marcador hexagonal, que o OCR lê como um dígito
      // solto no começo da linha.
      return ponta === 'inicio' && /^\d$/.test(token)
    }
    return !/^(e|ou|de|da|do|em|com|no|na|kg|s)$/i.test(token)
  }

  let inicio = 0
  while (inicio < tokens.length && ehLixo(tokens[inicio], 'inicio')) inicio += 1
  let fim = tokens.length
  while (fim > inicio && ehLixo(tokens[fim - 1], 'fim')) fim -= 1

  return tokens
    .slice(inicio, fim)
    // O "+" é conteúdo: separa os dois movimentos de um bi-set
    // ("Rosca direta barra + rosca direta corda").
    .filter((token) => token === '+' || !/^[^\p{L}\p{N}]+$/u.test(token))
    .join(' ')
    .trim()
}

/** Títulos da apostila que não são exercício ("TREINO 4 VEZES NA SEMANA"). */
const RE_CABECALHO =
  /^(treino|sugest[aã]o|divis[aã]o|semana|obs|aten[çc][aã]o|n[uú]mero|repeti[çc])/i

/** Uma linha só é nome plausível se tiver alguma palavra de verdade. */
function pareceNome(texto: string): boolean {
  if (texto.length < 4) return false
  if (RE_INTERVALO.test(texto) || RE_TEM_SERIE.test(texto)) return false
  if (RE_CABECALHO.test(texto)) return false
  // Linha inteira em maiúsculas é título de seção, não nome de exercício —
  // o layout escreve os exercícios em caixa mista.
  if (texto === texto.toUpperCase() && /\p{L}{3,}/u.test(texto)) return false
  return /\p{L}{4,}/u.test(texto)
}

function classificarSecao(nome: string): Section {
  return /aquecimento|aproxima|alongamento|mobilidade/.test(deaccent(nome)) ? 'warmup' : 'main'
}

interface CartaoEmMontagem {
  linhas: string[]
  intervalo: string | null
  confianca: number
}

export function parseCardPlanFromPages(
  pages: PositionedPage[],
  options: { name: string },
): ParsedPlan {
  const warnings: string[] = []
  const semSeries: string[] = []
  const workouts: ParsedWorkout[] = []
  let treinoAtual: ParsedWorkout | null = null
  let usouMarcadorDeTreino = false

  const abrirTreino = (nome: string) => {
    treinoAtual = {
      name: nome,
      weekNumber: NO_WEEK,
      weekday: NO_WEEKDAY,
      exercises: [],
    }
    workouts.push(treinoAtual)
  }

  for (const page of pages) {
    // Corte de confiança medido nestes PDFs: a 0,5 o ruído de fundo some e o
    // conteúdo real permanece. Acima de 0,65 já começa a comer série de
    // verdade ("Repetições: (3x 8 a 12)" perdia o "(3x 8 a").
    const itens =
      page.source === 'ocr' ? page.items.filter((item) => item.confidence >= 0.5) : page.items
    const linhas = toLines(itens, page.source === 'ocr' ? 6 : 3)
    /**
     * Para SÉRIES vale a pena aceitar palavra de baixa confiança: o formato
     * `(3x 8 a 12)` é distintivo o bastante para o ruído de fundo não imitar,
     * e perder a série é pior que arriscar uma leitura duvidosa — que aparece
     * na conferência de qualquer jeito.
     */
    const linhasCompletas = toLines(page.items, page.source === 'ocr' ? 6 : 3)

    // Caminho preferido: as faixas douradas dão a fronteira exata de cada
    // cartão, então nome, intervalo e séries não têm como escorregar de
    // exercício. A heurística por texto abaixo só entra quando não há cor.
    const faixas = page.highlightBands ?? []
    if (faixas.length) {
      for (let indice = 0; indice < faixas.length; indice += 1) {
        const faixa = faixas[indice]
        const limiteInferior = faixas[indice + 1]?.top ?? Number.POSITIVE_INFINITY

        // Margem folgada embaixo: descidas de letra ("pé") caem alguns pontos
        // abaixo da faixa colorida e sumiam do nome.
        const linhasDoNome = linhas.filter((l) => l.y >= faixa.top - 5 && l.y <= faixa.bottom + 13)
        const nomeLido = limparRuido(linhasDoNome.map((l) => l.text).join(' '))
        if (!nomeLido || !pareceNome(nomeLido)) continue

        // Encaixa no vocabulário do plano quando houver candidato bom o
        // bastante — é o que conserta "Pulleyfrente" e "Lombarno banco romano".
        const encaixe = page.source === 'ocr' ? matchExerciseName(nomeLido) : null
        const nome = encaixe?.name ?? nomeLido

        const corpo = linhas.filter((l) => l.y > faixa.bottom + 13 && l.y < limiteInferior - 5)

        const descricao: string[] = []
        let intervalo: string | null = null
        const tokensSerie = []
        let confianca = 1

        for (const linha of corpo) {
          const limpo = limparRuido(linha.text)
          if (!limpo) continue
          const confiancaLinha = linha.items.length
            ? linha.items.reduce((soma, item) => soma + item.confidence, 0) / linha.items.length
            : 1
          confianca = Math.min(confianca, confiancaLinha)

          if (RE_INTERVALO.test(limpo)) {
            intervalo = limpo
            continue
          }
          // Qualquer parêntese marca pedaço de série — inclusive o fragmento
          // final de um token que quebrou de linha ("pause)", "drop)"). Sem
          // isso ele vazava para a técnica do exercício.
          if (/[()]/.test(limpo) || RE_TEM_SERIE.test(limpo)) continue
          descricao.push(limpo)
        }

        // As séries são tokenizadas sobre as linhas JUNTAS, porque no PDF um
        // token pode atravessar a quebra: "(1x 6 a 10 + 2 rest" numa linha e
        // "pause)" na seguinte. Linha a linha, esse token se perdia.
        const textoSeries = linhasCompletas
          .filter((linha) => linha.y > faixa.bottom + 13 && linha.y < limiteInferior - 5)
          .map((linha) => limparRuido(linha.text))
          .filter((limpo) => limpo && /[()]/.test(limpo))
          .join(' ')
        if (textoSeries) tokensSerie.push(...parseSeriesTokens(textoSeries))

        // A faixa dourada É a prova de que existe um exercício aqui. Se o OCR
        // perdeu a linha de séries, o exercício entra vazio e aparece marcado
        // na conferência — sumir em silêncio esconderia a falha do usuário.
        if (tokensSerie.length === 0) semSeries.push(nome)

        const rest = parseRest(intervalo ? limparIntervalo(intervalo) : null)
        const listaSeries: ParsedSeries[] = []
        for (const token of tokensSerie) {
          for (let i = 0; i < token.count; i++) {
            const ultima = i === token.count - 1
            listaSeries.push({
              seriesNumber: listaSeries.length + 1,
              targetText: ultima && token.suffix ? `${token.target} ${token.suffix}` : token.target,
              restSecondsMin: rest.restSecondsMin,
              restSecondsMax: rest.restSecondsMax,
              restNote: rest.restNote,
            })
          }
        }

        if (!treinoAtual) abrirTreino(`Treino ${String.fromCharCode(65 + workouts.length)}`)
        treinoAtual!.exercises.push({
          name: nome,
          originalName: encaixe && encaixe.name !== nomeLido ? nomeLido : undefined,
          section: classificarSecao(nome),
          technique: descricao.join(' ').trim() || null,
          series: listaSeries,
          confidence: confianca,
        })
      }

      if (!usouMarcadorDeTreino) treinoAtual = null
      continue
    }

    let cartao: CartaoEmMontagem = { linhas: [], intervalo: null, confianca: 1 }
    const series: string[] = []

    const fecharCartao = () => {
      const nomes = cartao.linhas.filter(pareceNome)
      const tokens = series.flatMap((linha) => parseSeriesTokens(linha))

      if (!nomes.length || tokens.length === 0) {
        cartao = { linhas: [], intervalo: null, confianca: 1 }
        series.length = 0
        return
      }

      const nome = nomes[0]
      const tecnica = nomes.slice(1).join(' ').trim() || null
      const rest = parseRest(cartao.intervalo ? limparIntervalo(cartao.intervalo) : null)

      const listaSeries: ParsedSeries[] = []
      for (const token of tokens) {
        for (let i = 0; i < token.count; i++) {
          // O sufixo ("+ 2 drop") descreve a ÚLTIMA série do grupo, não todas.
          const ultima = i === token.count - 1
          listaSeries.push({
            seriesNumber: listaSeries.length + 1,
            targetText: ultima && token.suffix ? `${token.target} ${token.suffix}` : token.target,
            restSecondsMin: rest.restSecondsMin,
            restSecondsMax: rest.restSecondsMax,
            restNote: rest.restNote,
          })
        }
      }

      if (!treinoAtual) abrirTreino(`Treino ${String.fromCharCode(65 + workouts.length)}`)

      const exercicio: ParsedExercise = {
        name: nome,
        section: classificarSecao(nome),
        technique: tecnica,
        series: listaSeries,
        confidence: cartao.confianca,
      }
      treinoAtual!.exercises.push(exercicio)

      cartao = { linhas: [], intervalo: null, confianca: 1 }
      series.length = 0
    }

    for (const linha of linhas) {
      const limpo = limparRuido(linha.text)
      if (!limpo) continue

      const confiancaLinha = linha.items.length
        ? linha.items.reduce((soma, item) => soma + item.confidence, 0) / linha.items.length
        : 1

      const marcadorTreino = limpo.match(RE_TREINO)
      if (marcadorTreino) {
        fecharCartao()
        usouMarcadorDeTreino = true
        abrirTreino(`Treino ${marcadorTreino[1].toUpperCase()}`)
        continue
      }

      if (RE_INTERVALO.test(limpo)) {
        cartao.intervalo = limpo
        cartao.confianca = Math.min(cartao.confianca, confiancaLinha)
        continue
      }

      if (RE_TEM_SERIE.test(limpo)) {
        series.push(limpo)
        cartao.confianca = Math.min(cartao.confianca, confiancaLinha)
        continue
      }

      // Linha de texto: se já havia séries, o cartão anterior acabou aqui.
      if (series.length) fecharCartao()
      cartao.linhas.push(limpo)
      cartao.confianca = Math.min(cartao.confianca, confiancaLinha)
    }

    fecharCartao()

    // Sem marcador "TREINO X" no arquivo, cada página vira um treino: é a
    // divisão que o layout sugere e que o usuário consegue renomear depois.
    if (!usouMarcadorDeTreino) treinoAtual = null
  }

  const comExercicios = workouts.filter((workout) => workout.exercises.length > 0)

  if (!usouMarcadorDeTreino && comExercicios.length > 1) {
    warnings.push(
      'O PDF não traz "Treino A/B/C" legível, então dividi um treino por página — confira e renomeie.',
    )
  }

  if (semSeries.length) {
    warnings.push(
      `${semSeries.length} exercício(s) foram identificados mas ficaram sem séries legíveis (${semSeries.slice(0, 4).join(', ')}${semSeries.length > 4 ? '…' : ''}) — preencha antes de salvar.`,
    )
  }

  if (pages.some((page) => page.source === 'ocr')) {
    // Aviso deliberadamente forte: neste layout, quando o OCR perde uma linha
    // de série, as séries seguintes escorregam para o exercício errado. O erro
    // é plausível o bastante para passar despercebido numa leitura rápida.
    warnings.push(
      'ATENÇÃO: neste PDF digitalizado as séries podem ter sido associadas ao exercício errado, e algumas podem estar faltando. Compare cada exercício com o PDF antes de salvar — trate o resultado como rascunho, não como importação fiel.',
    )
  }

  return {
    name: options.name,
    type: 'fixed',
    totalWeeks: 0,
    workouts: comExercicios,
    warnings,
    source: pages.some((p) => p.source === 'ocr') ? 'ocr' : 'text',
    confidence: 1,
  }
}
