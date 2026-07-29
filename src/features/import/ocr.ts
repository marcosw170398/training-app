import { createWorker, type Worker } from 'tesseract.js'
import type { PositionedPage, PositionedText } from './positioned'
import { renderPageToCanvas } from './readPdf'
import type * as pdfjs from 'pdfjs-dist'

/**
 * OCR das páginas que são imagem escaneada.
 *
 * Os arquivos do motor são servidos pelo próprio app (`/tesseract/`) em vez de
 * CDN: sem isso o OCR não funcionaria offline, que é o ponto do PWA. Eles ficam
 * fora do precache e só são baixados na primeira importação de um PDF
 * digitalizado — quem só usa PDF com texto nunca paga esses ~5 MB.
 */
const TESSERACT_PATHS = {
  workerPath: '/tesseract/worker.min.js',
  corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
  langPath: '/tesseract',
} as const

/** Palavra abaixo disto entra marcada para revisão em vez de ser descartada. */
export const CONFIANCA_BAIXA = 0.7

let workerPromise: Promise<Worker> | null = null

async function getWorker(onProgress?: (pct: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('por', 1, {
      ...TESSERACT_PATHS,
      logger: (m) => {
        if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
          onProgress?.(m.progress)
        }
      },
    })
  }
  return workerPromise
}

/** Libera o motor — ~5 MB de memória que não faz sentido segurar após importar. */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise
  workerPromise = null
  await worker.terminate()
}

interface TesseractWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

/** A v6+ entrega as palavras dentro de blocks; versões antigas, em `words`. */
function extrairPalavras(data: unknown): TesseractWord[] {
  const d = data as {
    words?: TesseractWord[]
    blocks?: { paragraphs?: { lines?: { words?: TesseractWord[] }[] }[] }[]
  }
  if (d.words?.length) return d.words

  const palavras: TesseractWord[] = []
  for (const block of d.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) palavras.push(word)
      }
    }
  }
  return palavras
}

export interface OcrProgress {
  pageNumber: number
  /** 0..1 dentro da página atual. */
  progress: number
  stage: 'carregando motor' | 'lendo página'
}

/**
 * Binariza a página antes do OCR.
 *
 * Os PDFs digitalizados do plano têm fundo texturizado e caixas coloridas; o
 * tesseract trata essa textura como caractere e produz lixo entre as palavras
 * de verdade. Jogar tudo para preto ou branco remove a textura e deixa só o
 * traço do texto.
 */
function binarizar(canvas: HTMLCanvasElement, limiar: number): void {
  const context = canvas.getContext('2d')
  if (!context) return
  const imagem = context.getImageData(0, 0, canvas.width, canvas.height)
  const dados = imagem.data
  for (let i = 0; i < dados.length; i += 4) {
    const cinza = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2]
    const valor = cinza > limiar ? 255 : 0
    dados[i] = valor
    dados[i + 1] = valor
    dados[i + 2] = valor
  }
  context.putImageData(imagem, 0, 0)
}

export interface OcrOptions {
  /**
   * Largura de renderização em pixels.
   *
   * Medido nos PDFs digitalizados do plano: 1700px rende melhor que os 2480px
   * do original (34% de confiança) e que qualquer variação binarizada — subir a
   * resolução só dá mais textura de fundo para o tesseract confundir com letra.
   */
  targetWidth?: number
  /**
   * Limiar de binarização; 0 desliga.
   *
   * Desligado por padrão: nos testes ele aumentou a contagem de palavras
   * "boas", mas corrompeu dígitos — "(1x15a20)" virava "(1x15320)". Em plano de
   * treino, número errado é pior que palavra perdida.
   */
  threshold?: number
}

export async function ocrPage(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  onProgress?: (p: OcrProgress) => void,
  options: OcrOptions = {},
): Promise<PositionedPage> {
  const rendered = await renderPageToCanvas(doc, pageNumber, options.targetWidth ?? 1700)
  const limiar = options.threshold ?? 0
  if (limiar > 0) binarizar(rendered.canvas, limiar)
  const worker = await getWorker((pct) =>
    onProgress?.({ pageNumber, progress: pct, stage: 'carregando motor' }),
  )

  onProgress?.({ pageNumber, progress: 0, stage: 'lendo página' })
  const { data } = await worker.recognize(rendered.canvas, {}, { blocks: true })
  onProgress?.({ pageNumber, progress: 1, stage: 'lendo página' })

  const items: PositionedText[] = []
  for (const word of extrairPalavras(data)) {
    const texto = word.text?.trim()
    if (!texto) continue
    const { x0, y0, x1, y1 } = word.bbox
    items.push({
      text: texto,
      // De volta para pontos do PDF: o parser inteiro raciocina nessa unidade.
      x: x0 / rendered.scale,
      y: ((y0 + y1) / 2) / rendered.scale,
      width: (x1 - x0) / rendered.scale,
      height: (y1 - y0) / rendered.scale,
      confidence: (word.confidence ?? 0) / 100,
    })
  }

  return {
    pageNumber,
    width: rendered.width,
    height: rendered.height,
    items,
    source: 'ocr',
  }
}
