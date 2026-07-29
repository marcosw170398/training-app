import { NO_WEEK, NO_WEEKDAY, type Section } from '@/db/schema'
import { deaccent } from '@/lib/text'
import { WEEKDAYS } from '@/lib/weekday'
import type { PositionedPage } from './positioned'
import { buildRows, columnsFromHeader, toLines, type TableColumn, type TextLine } from './table'
import { parseRest } from './parseRest'
import type { ParsedExercise, ParsedPlan, ParsedSeries, ParsedWorkout } from './parsedPlan'

const RE_SEMANA = /^semana\s*(\d+)$/
/**
 * Marcadores precisam casar com a linha INTEIRA.
 *
 * O cabeçalho da tabela de preparação começa com a palavra "Preparação"
 * ("Preparação | Exercício | Primeira série | …"), e a coluna de tipo repete
 * "Preparação" nas linhas de dados. Um regex sem âncora no fim engoliria os
 * dois e a tabela inteira desapareceria do resultado.
 */
const RE_PREPARACAO = /^prepara[çc][ãa]o:?$/
const RE_EXERCICIOS = /^exerc[íi]cios?:?$/
/** Cabeçalho de tabela: tem a coluna "Exercício" e ao menos uma de série. */
const RE_HEADER = /exerc[íi]cio/
const RE_COLUNA_SERIE = /s[ée]rie/
const RE_COLUNA_INTERVALO = /intervalo/
const RE_COLUNA_NOME = /exerc[íi]cio/

/** Distância vertical acima da qual a tabela certamente acabou (rodapé, etc). */
const FIM_DE_TABELA = 40

function matchWeekday(text: string): number {
  const norm = deaccent(text)
  const dia = WEEKDAYS.find((w) => deaccent(w.label) === norm)
  return dia?.value ?? NO_WEEKDAY
}

/** Célula vazia no plano é "-"; normaliza para string vazia. */
function limparCelula(valor: string): string {
  const texto = valor.replace(/\s+/g, ' ').trim()
  if (!texto || /^[-–—]+$/.test(texto)) return ''
  // "10 segundos -" -> "10 segundos": traços soltos são marcador de vazio que
  // caiu na coluna vizinha, não conteúdo.
  return texto.replace(/\s+[-–—]+$/g, '').trim()
}

interface ColunasTabela {
  colunas: TableColumn[]
  indiceNome: number
  indicesSerie: number[]
  indiceIntervalo: number
  /** Coluna de tipo ("Aquecimento", "Fase de conexão") na tabela de preparação. */
  indiceTipo: number
}

function mapearColunas(header: TextLine): ColunasTabela | null {
  const colunas = columnsFromHeader(header)
  const rotulos = colunas.map((c) => deaccent(c.label))

  const indiceNome = rotulos.findIndex((r) => RE_COLUNA_NOME.test(r))
  if (indiceNome < 0) return null

  const indicesSerie = rotulos
    .map((r, i) => (RE_COLUNA_SERIE.test(r) ? i : -1))
    .filter((i) => i >= 0)
  if (indicesSerie.length === 0) return null

  const indiceIntervalo = rotulos.findIndex((r) => RE_COLUNA_INTERVALO.test(r))
  // Qualquer coluna antes do nome é a de tipo (só a tabela de preparação tem).
  const indiceTipo = indiceNome > 0 ? indiceNome - 1 : -1

  return { colunas, indiceNome, indicesSerie, indiceIntervalo, indiceTipo }
}

/**
 * Classifica a linha da tabela de exercícios.
 *
 * A tabela de PREPARAÇÃO inteira é `warmup`. Dentro de EXERCÍCIOS, uma linha
 * cujo nome carrega "aquecimento"/"aproximação" é série de aproximação
 * (`rampup`): registra carga, mas fica fora dos gráficos de evolução.
 */
function classificarSecao(nome: string, tabela: 'preparacao' | 'exercicios'): Section {
  if (tabela === 'preparacao') return 'warmup'
  return /aquecimento|aproxima/.test(deaccent(nome)) ? 'rampup' : 'main'
}

export interface ParseOptions {
  /** Nome sugerido para o plano (normalmente o nome do arquivo). */
  name: string
}

export function parsePlanFromPages(pages: PositionedPage[], options: ParseOptions): ParsedPlan {
  const warnings: string[] = []
  const workouts: ParsedWorkout[] = []
  const fontes = new Set(pages.map((p) => p.source))

  let semanaAtual = NO_WEEK
  let treinoAtual: ParsedWorkout | null = null
  let tabelaAtual: 'preparacao' | 'exercicios' | null = null

  const novoTreino = (weekday: number, nome: string) => {
    const treino: ParsedWorkout = {
      name: nome,
      weekNumber: semanaAtual,
      weekday,
      exercises: [],
    }
    workouts.push(treino)
    treinoAtual = treino
  }

  for (const page of pages) {
    // O OCR mede a altura de cada palavra, então o centro vertical oscila mais
    // que a baseline exata da camada de texto — a tolerância de linha precisa
    // acompanhar, senão uma linha vira duas.
    const linhas = toLines(page.items, page.source === 'ocr' ? 6 : 3)

    let i = 0
    while (i < linhas.length) {
      const linha = linhas[i]
      const norm = deaccent(linha.text)

      // Cabeçalho é testado primeiro: ele contém palavras que também são
      // marcadores, e perder o cabeçalho significa perder a tabela toda.
      const ehCabecalho = RE_HEADER.test(norm) && RE_COLUNA_SERIE.test(norm)

      const semana = !ehCabecalho && norm.match(RE_SEMANA)
      if (semana) {
        const numero = Number(semana[1])
        // Só zera o treino quando a semana MUDA de fato. Cada página repete o
        // cabeçalho da semana, e um treino que transborda para a página
        // seguinte precisa continuar no mesmo treino — senão a tabela órfã
        // vira um treino fantasma.
        if (numero !== semanaAtual) {
          semanaAtual = numero
          treinoAtual = null
        }
        i += 1
        continue
      }

      const weekday = ehCabecalho ? NO_WEEKDAY : matchWeekday(linha.text)
      if (weekday !== NO_WEEKDAY) {
        novoTreino(weekday, linha.text.trim())
        tabelaAtual = null
        i += 1
        continue
      }

      if (!ehCabecalho && RE_PREPARACAO.test(norm)) {
        tabelaAtual = 'preparacao'
        i += 1
        continue
      }

      if (!ehCabecalho && RE_EXERCICIOS.test(norm)) {
        tabelaAtual = 'exercicios'
        i += 1
        continue
      }

      if (!ehCabecalho) {
        i += 1
        continue
      }

      const mapa = mapearColunas(linha)
      if (!mapa) {
        warnings.push(`Página ${page.pageNumber}: cabeçalho de tabela não reconhecido.`)
        i += 1
        continue
      }

      // Coleta as linhas de dados até o próximo marcador ou um salto vertical.
      const dados: TextLine[] = []
      let j = i + 1
      let anterior = linha
      while (j < linhas.length) {
        const candidata = linhas[j]
        const normCandidata = deaccent(candidata.text)
        const ehMarcador =
          RE_SEMANA.test(normCandidata) ||
          RE_PREPARACAO.test(normCandidata) ||
          RE_EXERCICIOS.test(normCandidata) ||
          matchWeekday(candidata.text) !== NO_WEEKDAY
        if (ehMarcador || candidata.y - anterior.y > FIM_DE_TABELA) break
        dados.push(candidata)
        anterior = candidata
        j += 1
      }

      if (!treinoAtual) {
        // Plano fixo (Treino A/B/C) não traz dia da semana: o treino nasce da
        // própria tabela.
        novoTreino(NO_WEEKDAY, `Treino ${String.fromCharCode(65 + workouts.length)}`)
      }

      const kind = tabelaAtual ?? 'exercicios'
      for (const row of buildRows(dados, mapa.colunas)) {
        const nome = limparCelula(row.cells[mapa.indiceNome] ?? '')
        const intervalo =
          mapa.indiceIntervalo >= 0 ? limparCelula(row.cells[mapa.indiceIntervalo] ?? '') : ''
        const alvos = mapa.indicesSerie.map((index) => limparCelula(row.cells[index] ?? ''))

        // Sem nome ou sem nenhum alvo: é rodapé/ruído, não exercício.
        if (!nome || alvos.every((a) => !a)) continue

        const rest = parseRest(intervalo)
        const series: ParsedSeries[] = []
        alvos.forEach((alvo, index) => {
          if (!alvo) return
          series.push({
            seriesNumber: series.length + 1,
            targetText: alvo,
            restSecondsMin: rest.restSecondsMin,
            restSecondsMax: rest.restSecondsMax,
            restNote: rest.restNote,
          })
          void index
        })

        const tipo = mapa.indiceTipo >= 0 ? limparCelula(row.cells[mapa.indiceTipo] ?? '') : ''

        const exercicio: ParsedExercise = {
          name: nome,
          section: classificarSecao(nome, kind),
          technique: tipo || null,
          series,
          confidence: row.confidence,
        }
        treinoAtual!.exercises.push(exercicio)
      }

      i = j
    }
  }

  const semanas = workouts.map((w) => w.weekNumber).filter((n) => n > 0)
  const type = semanas.length ? 'periodized' : 'fixed'

  if (workouts.length === 0) {
    warnings.push('Nenhum treino reconhecido — confira se o PDF é mesmo uma planilha de treino.')
  }
  for (const workout of workouts) {
    if (workout.exercises.length === 0) {
      warnings.push(`"${workout.name}" ficou sem exercícios.`)
    }
  }

  // O plano às vezes traz o intervalo uma única vez para um bloco de linhas.
  // Não dá para adivinhar de qual bloco cada linha faz parte, então em vez de
  // chutar um valor eu aponto o caso para o usuário resolver na conferência.
  const semDescanso = workouts.flatMap((workout) =>
    workout.exercises
      .filter(
        (exercise) =>
          exercise.section !== 'warmup' &&
          exercise.series.length > 0 &&
          exercise.series[0].restSecondsMin === null &&
          !exercise.series[0].restNote,
      )
      .map((exercise) => `${workout.name}: ${exercise.name}`),
  )
  if (semDescanso.length) {
    warnings.push(
      `${semDescanso.length} exercício(s) ficaram sem intervalo definido — confira o descanso antes de salvar.`,
    )
  }

  return {
    name: options.name,
    type,
    totalWeeks: type === 'periodized' ? Math.max(...semanas) : 0,
    workouts,
    warnings,
    source: fontes.has('ocr') ? 'ocr' : 'text',
    confidence: 1,
  }
}
