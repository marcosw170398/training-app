/**
 * Formato intermediário entre a leitura do PDF e o parser do plano.
 *
 * As DUAS rotas de leitura desembocam aqui — camada de texto (pdf.js) e OCR
 * (tesseract) — e nada abaixo deste ponto sabe de qual delas o dado veio. É o
 * que evita ter dois parsers para manter em sincronia.
 *
 * Convenção: `y` cresce para BAIXO (origem no topo da página). O pdf.js entrega
 * o oposto, então a conversão acontece na extração; o OCR já vem assim.
 */
export interface PositionedText {
  text: string
  x: number
  y: number
  width: number
  height: number
  /** 0..1 — só o OCR preenche; a camada de texto é sempre 1. */
  confidence: number
}

export interface PositionedPage {
  pageNumber: number
  width: number
  height: number
  items: PositionedText[]
  /** De onde veio o texto desta página. */
  source: 'text' | 'ocr'
}

export const centerX = (item: PositionedText): number => item.x + item.width / 2
export const rightX = (item: PositionedText): number => item.x + item.width
