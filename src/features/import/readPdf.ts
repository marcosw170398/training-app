import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PositionedPage, PositionedText } from './positioned'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/**
 * Uma página com pelo menos esta quantidade de itens carrega conteúdo de
 * verdade (uma tabela do plano rende ~150). Capa e página de instruções ficam
 * bem abaixo disso.
 */
const MIN_ITENS_TEXTO = 20

export interface PdfPageProbe {
  pageNumber: number
  /** Tem conteúdo textual suficiente para valer o parse. */
  hasContent: boolean
  textItems: number
}

export interface PdfDocumentHandle {
  numPages: number
  probes: PdfPageProbe[]
  /**
   * Modo do DOCUMENTO, não da página.
   *
   * Decidir por página faria a capa e a folha de instruções — que têm pouco
   * texto mas não são digitalizadas — irem parar no OCR, gastando um minuto
   * cada e rotulando um plano perfeitamente legível como "lido por OCR".
   */
  mode: 'text' | 'ocr'
  /** Páginas sem nenhum texto num documento que, no geral, tem camada de texto. */
  emptyPages: number[]
  doc: pdfjs.PDFDocumentProxy
}

export async function openPdf(file: File): Promise<PdfDocumentHandle> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise

  const probes: PdfPageProbe[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    const uteis = content.items.filter(
      (item) => 'str' in item && item.str.trim() && !/licenciado para/i.test(item.str),
    ).length
    probes.push({ pageNumber: n, hasContent: uteis >= MIN_ITENS_TEXTO, textItems: uteis })
  }

  // Basta UMA página com conteúdo textual para o documento inteiro ser tratado
  // como digital: o plano está no texto, e o resto são capas e ilustrações.
  const mode = probes.some((p) => p.hasContent) ? 'text' : 'ocr'

  return {
    numPages: doc.numPages,
    probes,
    mode,
    emptyPages: mode === 'text' ? probes.filter((p) => p.textItems === 0).map((p) => p.pageNumber) : [],
    doc,
  }
}

/** Extrai a camada de texto de uma página, já com `y` crescendo para baixo. */
export async function extractTextPage(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
): Promise<PositionedPage> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()

  const items: PositionedText[] = []
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    if (/licenciado para/i.test(item.str)) continue

    const [, , , , x, yBaseline] = item.transform as number[]
    const height = item.height || 10
    items.push({
      text: item.str.trim(),
      x,
      // pdf.js mede do rodapé para cima; o resto do pipeline (e o OCR) usa o
      // topo como origem.
      y: viewport.height - yBaseline,
      width: item.width || 0,
      height,
      confidence: 1,
    })
  }

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    items,
    source: 'text',
  }
}

export interface RenderedPage {
  canvas: HTMLCanvasElement
  /** Pixels do canvas por ponto do PDF — o OCR usa para voltar à escala do PDF. */
  scale: number
  /** Dimensões em pontos do PDF. */
  width: number
  height: number
}

/**
 * Renderiza a página num canvas — entrada do OCR.
 *
 * Devolve a escala junto: as coordenadas do OCR saem em pixels do canvas, e o
 * parser trabalha em pontos do PDF. Sem converter de volta, os limiares de
 * linha e de fim de tabela deixariam de valer.
 */
export async function renderPageToCanvas(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  targetWidth = 1700,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = targetWidth / base.width
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível criar o canvas para renderizar o PDF')

  await page.render({ canvas, canvasContext: context, viewport }).promise
  return { canvas, scale, width: base.width, height: base.height }
}
