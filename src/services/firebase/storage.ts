import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from './config'

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot) : ''
}

/** Sobe um arquivo pra `cenas/{cenaId}/{pasta}/{id}.ext` e retorna a URL de download + o path (pra excluir depois). */
export async function uploadCenaFile(
  cenaId: string,
  pasta: 'figurino' | 'musicas',
  file: File,
): Promise<{ id: string; url: string; path: string }> {
  const id = crypto.randomUUID()
  const path = `cenas/${cenaId}/${pasta}/${id}${extensionOf(file.name)}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file, { contentType: file.type })
  const url = await getDownloadURL(fileRef)
  return { id, url, path }
}

/** Remove um arquivo do Storage — não falha se ele já não existir mais. */
export async function deleteCenaFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path))
  } catch {
    // já não existe / já foi removido — nada a fazer
  }
}

/** Sobe um arquivo pra `{pasta}/{id}.ext` (fora das pastas de cena) — ex.: comprovantes de gasto. */
export async function uploadArquivo(pasta: string, file: File): Promise<{ id: string; url: string; path: string }> {
  const id = crypto.randomUUID()
  const path = `${pasta}/${id}${extensionOf(file.name)}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file, { contentType: file.type })
  const url = await getDownloadURL(fileRef)
  return { id, url, path }
}
