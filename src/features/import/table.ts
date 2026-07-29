import { centerX, rightX, type PositionedText } from './positioned'

/** Uma linha visual: itens que compartilham a mesma baseline. */
export interface TextLine {
  y: number
  items: PositionedText[]
  text: string
}

/** Uma linha lógica da tabela — pode ocupar várias linhas visuais. */
export interface TableRow {
  y: number
  /** Uma posição por coluna do cabeçalho; string vazia quando a célula é vazia. */
  cells: string[]
  confidence: number
}

export interface TableColumn {
  label: string
  center: number
}

/**
 * Agrupa itens em linhas visuais e junta os fragmentos de cada célula.
 *
 * A ordem importa: agrupar PRIMEIRO em linhas e só então percorrer da esquerda
 * para a direita. Itens de uma mesma linha do PDF têm `y` com diferença de
 * frações de ponto, então ordenar por `y` antes de `x` embaralha a ordem de
 * leitura e faz a última coluna colar na primeira da linha seguinte.
 *
 * `maxGap` decide o que é a mesma célula: o pdf.js costuma entregar a célula
 * inteira, mas o OCR entrega palavra a palavra — juntar aqui é o que permite
 * aos dois caminhos usarem o mesmo detector de colunas.
 */
export function toLines(items: PositionedText[], tolerance = 3, maxGap = 8): TextLine[] {
  const linhas: TextLine[] = []

  for (const item of [...items].sort((a, b) => a.y - b.y)) {
    const linha = linhas.find((l) => Math.abs(l.y - item.y) <= tolerance)
    if (linha) {
      linha.items.push(item)
      continue
    }
    linhas.push({ y: item.y, items: [item], text: '' })
  }

  for (const linha of linhas) {
    linha.items.sort((a, b) => a.x - b.x)

    const juntos: PositionedText[] = []
    for (const item of linha.items) {
      const anterior = juntos.at(-1)
      const gap = anterior ? item.x - rightX(anterior) : Infinity
      // `gap >= 0` barra sobreposição/retrocesso: sem isso, um item à esquerda
      // do anterior seria tratado como continuação dele.
      if (anterior && gap >= 0 && gap <= maxGap) {
        anterior.text = `${anterior.text} ${item.text}`.replace(/\s+/g, ' ').trim()
        anterior.width = rightX(item) - anterior.x
        anterior.height = Math.max(anterior.height, item.height)
        anterior.confidence = Math.min(anterior.confidence, item.confidence)
        continue
      }
      juntos.push({ ...item })
    }

    linha.items = juntos
    linha.text = juntos
      .map((i) => i.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return linhas.sort((a, b) => a.y - b.y)
}

/**
 * Deriva as colunas do cabeçalho da tabela.
 *
 * Ler as colunas do cabeçalho, em vez de fixá-las, é o que faz o parser
 * aguentar tabelas com 2, 3 ou 4 colunas de série sem código condicional.
 */
export function columnsFromHeader(header: TextLine): TableColumn[] {
  return header.items
    .map((item) => ({ label: item.text.trim(), center: centerX(item) }))
    .sort((a, b) => a.center - b.center)
}

/** Índice da coluna cujo centro está mais próximo do item. */
function columnIndexFor(item: PositionedText, columns: TableColumn[]): number {
  const center = centerX(item)
  let melhor = 0
  let menorDistancia = Infinity
  columns.forEach((coluna, index) => {
    const distancia = Math.abs(coluna.center - center)
    if (distancia < menorDistancia) {
      menorDistancia = distancia
      melhor = index
    }
  })
  return melhor
}

/**
 * Junta linhas visuais em linhas lógicas.
 *
 * `rowGap` é o segredo aqui: no PDF do plano, linhas diferentes distam ~20pt,
 * enquanto a quebra interna de uma célula ("Flexão de braço" / "no banco")
 * fica a 4–6pt. Um limiar no meio separa as duas coisas sem ambiguidade.
 */
export function buildRows(lines: TextLine[], columns: TableColumn[], rowGap = 12): TableRow[] {
  const grupos: TextLine[][] = []

  for (const linha of lines) {
    const grupoAtual = grupos.at(-1)
    const ultima = grupoAtual?.at(-1)
    if (grupoAtual && ultima && linha.y - ultima.y <= rowGap) {
      grupoAtual.push(linha)
      continue
    }
    grupos.push([linha])
  }

  return grupos.map((grupo) => {
    const cells = columns.map(() => '')
    let confidence = 1

    for (const linha of grupo) {
      for (const item of linha.items) {
        const index = columnIndexFor(item, columns)
        // Continuação de célula ("Tríceps testa na" + "polia alta") entra com
        // espaço, preservando a ordem de leitura.
        cells[index] = cells[index] ? `${cells[index]} ${item.text}`.trim() : item.text.trim()
        confidence = Math.min(confidence, item.confidence)
      }
    }

    return {
      y: grupo[0].y,
      cells: cells.map((c) => c.replace(/\s+/g, ' ').trim()),
      confidence,
    }
  })
}
