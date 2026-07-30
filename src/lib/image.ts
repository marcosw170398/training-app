export interface ImagemReduzida {
  blob: Blob
  width: number
  height: number
}

/**
 * Reduz a foto antes de gravar no IndexedDB.
 *
 * Foto de celular tem 3–5 MB; algumas dezenas estourariam a cota do navegador,
 * e aqui não existe servidor para onde mandar. 1280 px no maior lado é
 * suficiente para a foto do treino no calendário.
 *
 * `createImageBitmap` respeita a orientação EXIF, então foto tirada na vertical
 * não sai deitada.
 */
export async function reduzirImagem(
  arquivo: File | Blob,
  maiorLado = 1280,
  qualidade = 0.75,
): Promise<ImagemReduzida> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })

  const escala = Math.min(1, maiorLado / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * escala)
  const height = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('Não foi possível processar a imagem')
  contexto.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', qualidade),
  )
  if (!blob) throw new Error('Não foi possível comprimir a imagem')

  return { blob, width, height }
}
