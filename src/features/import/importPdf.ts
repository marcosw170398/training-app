import type { PositionedPage } from './positioned'
import { extractTextPage, openPdf } from './readPdf'
import { ocrPage, terminateOcr } from './ocr'
import { parsePlanFromPages } from './parsePlan'
import type { ParsedPlan } from './parsedPlan'

export interface ImportProgress {
  stage: 'abrindo' | 'lendo texto' | 'carregando motor' | 'lendo imagem' | 'interpretando'
  current: number
  total: number
  detail?: string
}

function nomeDoArquivo(file: File): string {
  return file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Plano importado'
}

/**
 * Lê um PDF inteiro e devolve o plano interpretado.
 *
 * Cada página escolhe seu caminho: camada de texto quando existe (rápido e
 * exato), OCR quando a página é imagem. Os dois produzem `PositionedText`, e o
 * parser adiante não sabe a diferença.
 */
export async function readPlanFromPdf(
  file: File,
  onProgress?: (p: ImportProgress) => void,
): Promise<ParsedPlan> {
  onProgress?.({ stage: 'abrindo', current: 0, total: 1 })
  const handle = await openPdf(file)

  const pages: PositionedPage[] = []
  const total = handle.numPages
  let processadas = 0

  try {
    for (const probe of handle.probes) {
      if (handle.mode === 'text') {
        onProgress?.({ stage: 'lendo texto', current: processadas, total })
        pages.push(await extractTextPage(handle.doc, probe.pageNumber))
      } else {
        onProgress?.({
          stage: 'lendo imagem',
          current: processadas,
          total,
          detail: `página ${probe.pageNumber}`,
        })
        pages.push(
          await ocrPage(handle.doc, probe.pageNumber, (p) =>
            onProgress?.({
              stage: p.stage === 'carregando motor' ? 'carregando motor' : 'lendo imagem',
              current: processadas,
              total,
              detail: `página ${probe.pageNumber}`,
            }),
          ),
        )
      }
      processadas += 1
    }
  } finally {
    // O motor de OCR segura ~5 MB; não faz sentido mantê-lo vivo depois.
    if (handle.mode === 'ocr') await terminateOcr()
  }

  onProgress?.({ stage: 'interpretando', current: total, total })
  const plano = parsePlanFromPages(pages, { name: nomeDoArquivo(file) })

  if (handle.mode === 'ocr') {
    const lidos = pages.flatMap((p) => p.items)
    const confianca = lidos.length
      ? lidos.reduce((soma, item) => soma + item.confidence, 0) / lidos.length
      : 0
    plano.confidence = confianca

    plano.warnings.unshift(
      `Este PDF é digitalizado e foi lido por OCR com ${Math.round(confianca * 100)}% de confiança média. Confira exercício por exercício — principalmente os números.`,
    )
  } else if (handle.emptyPages.length) {
    plano.warnings.push(
      `Página(s) ${handle.emptyPages.join(', ')} não têm texto e foram ignoradas — se houver treino nelas, cadastre à mão.`,
    )
  }

  return plano
}
