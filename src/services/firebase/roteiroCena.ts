import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './config'
import { CACHE_IMUTAVEL, deleteCenaFile } from './storage'
import type { BlocoRoteiro } from '@/lib/roteiroCena'
import type { RoteiroCena, RoteiroTipo } from '@/types'

/** O recorte do roteiro de uma cena (`null` se o admin ainda não gerou). */
export function subscribeToRoteiroCena(cenaId: string, callback: (r: RoteiroCena | null) => void) {
  return onSnapshot(
    doc(db, 'roteirosCena', cenaId),
    snap => {
      if (!snap.exists()) return callback(null)
      const d = snap.data()
      callback({ ...d, cenaId: snap.id, geradoEm: d.geradoEm?.toDate?.().toISOString() ?? new Date().toISOString() } as RoteiroCena)
    },
    () => callback(null),
  )
}

export interface SalvarRoteiroInput {
  cenaId: string
  tipo: RoteiroTipo
  paginaInicio: number
  paginaFim: number
  marcadorInicio?: string
  marcadorFim?: string
  pdf: Uint8Array
  blocos: BlocoRoteiro[]
  byUid: string
  /** Recorte anterior — o PDF dele é apagado depois de salvar o novo. */
  anterior?: RoteiroCena | null
}

/** Sobe o PDF recortado e grava as falas. Só admin (firestore.rules). */
export async function salvarRoteiroCena(input: SalvarRoteiroInput): Promise<void> {
  const pdfPath = `cenas/${input.cenaId}/roteiro/${crypto.randomUUID()}.pdf`
  const arquivo = ref(storage, pdfPath)
  await uploadBytes(arquivo, input.pdf, { contentType: 'application/pdf', cacheControl: CACHE_IMUTAVEL })
  const pdfUrl = await getDownloadURL(arquivo)
  await setDoc(doc(db, 'roteirosCena', input.cenaId), {
    tipo: input.tipo,
    paginaInicio: input.paginaInicio,
    paginaFim: input.paginaFim,
    marcadorInicio: input.marcadorInicio?.trim() ?? '',
    marcadorFim: input.marcadorFim?.trim() ?? '',
    pdfPath,
    pdfUrl,
    blocos: input.blocos,
    geradoPorUid: input.byUid,
    geradoEm: serverTimestamp(),
  })
  if (input.anterior?.pdfPath) await deleteCenaFile(input.anterior.pdfPath)
}

export async function removerRoteiroCena(roteiro: RoteiroCena): Promise<void> {
  await deleteDoc(doc(db, 'roteirosCena', roteiro.cenaId))
  await deleteCenaFile(roteiro.pdfPath)
}
