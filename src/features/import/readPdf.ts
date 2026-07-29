import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PositionedPage, PositionedText } from './positioned'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/**
 * Abaixo disto a página não tem texto de verdade — é imagem escaneada, e só o
 * OCR consegue lê-la. O rodapé/marca d'água sozinho já rende alguns itens, daí
 * o limiar não ser zero.
 */
const MIN_ITENS_TEXTO = 20

export interface PdfPageProbe {
  pageNumber: number
  hasTextLayer: boolean
  textItems: number
}

export interface PdfDocumentHandle {
  numPages: number
  probes: PdfPageProbe[]
  /** Quantas páginas precisariam de OCR. */
  imagePages: number
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
    probes.push({ pageNumber: n, hasTextLayer: uteis >= MIN_ITENS_TEXTO, textItems: uteis })
  }

  return {
    numPages: doc.numPages,
    probes,
    imagePages: probes.filter((p) => !p.hasTextLayer).length,
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

/** Renderiza a página num canvas — entrada do OCR. */
export async function renderPageToCanvas(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  targetWidth = 1600,
): Promise<HTMLCanvasElement> {
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
  return canvas
}
