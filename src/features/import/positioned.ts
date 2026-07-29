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
  /**
   * Cor média do texto na página renderizada (só na rota de OCR).
   *
   * É o sinal mais confiável que existe nesses PDFs: o layout marca o nome do
   * exercício em amarelo, e cor não se corrompe quando o OCR erra a letra.
   */
  color?: { r: number; g: number; b: number }
}

/** O destaque dourado que o plano usa no nome do exercício. */
export function isHighlightColor(color: PositionedText['color']): boolean {
  if (!color) return false
  const { r, g, b } = color
  return r > 120 && g > 90 && b < 110 && r - b > 55 && g - b > 30
}

/** Faixa vertical onde o layout pinta o nome do exercício em dourado. */
export interface HighlightBand {
  top: number
  bottom: number
}

export interface PositionedPage {
  pageNumber: number
  width: number
  height: number
  items: PositionedText[]
  /** De onde veio o texto desta página. */
  source: 'text' | 'ocr'
  /**
   * Faixas douradas detectadas na página renderizada, em pontos do PDF.
   *
   * É o limite EXATO de cada cartão de exercício, obtido da cor e não do texto
   * — então sobrevive intacto por mais que o OCR erre letras. Sem isso, uma
   * linha de série perdida faz todas as seguintes escorregarem para o
   * exercício vizinho.
   */
  highlightBands?: HighlightBand[]
}

export const centerX = (item: PositionedText): number => item.x + item.width / 2
export const rightX = (item: PositionedText): number => item.x + item.width
