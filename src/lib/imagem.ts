/**
 * Recorta a imagem no centro (quadrado) e reduz pra `lado` px, em JPEG — foto de perfil leve, que
 * carrega rápido nas listas. Fotos de celular chegam com vários MB; o resultado fica em ~50–100KB.
 */
export async function reduzirFotoQuadrada(file: File, lado = 512): Promise<Blob> {
  // `imageOrientation: 'from-image'` respeita a rotação EXIF das fotos tiradas em pé no celular.
  // Safari antigo não aceita as opções: tenta sem (lá a orientação já vem aplicada).
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file))
  const corte = Math.min(bitmap.width, bitmap.height)
  const destino = Math.min(lado, corte)
  const canvas = document.createElement('canvas')
  canvas.width = destino
  canvas.height = destino
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(bitmap, (bitmap.width - corte) / 2, (bitmap.height - corte) / 2, corte, corte, 0, 0, destino, destino)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/jpeg', 0.85),
  )
}

/**
 * `crossOrigin` pra uma `<img>`: foto do Storage é pedida com CORS (o Storage responde
 * `Access-Control-Allow-Origin: *`), pro service worker guardar a resposta de verdade — a "opaca"
 * (sem CORS) conta ~7 MB cada na cota do navegador, que estourava e apagava o cache de fotos.
 */
export function corsDoStorage(url: string | undefined | null): 'anonymous' | undefined {
  return url?.startsWith('https://firebasestorage.googleapis.com/') ? 'anonymous' : undefined
}
