import { collection, deleteDoc, deleteField, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from './config'
import { deleteCenaFile, uploadArquivo } from './storage'
import type { ImagemEquipe } from '@/types'

/**
 * Referências (imagens) das equipes: coleção `imagensEquipe`, arquivo em `equipes/{equipeId}/imagens/`.
 * Com `cenaId` a imagem também aparece na página da cena; sem, só na página da equipe.
 */

function semUndefined<T extends object>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function ordenar(imagens: ImagemEquipe[]) {
  return imagens.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
}

export function subscribeToImagensDaEquipe(equipeId: string, callback: (imagens: ImagemEquipe[]) => void) {
  return onSnapshot(
    query(collection(db, 'imagensEquipe'), where('equipeId', '==', equipeId)),
    snap => callback(ordenar(snap.docs.map(d => ({ ...d.data(), id: d.id }) as ImagemEquipe))),
    () => callback([]),
  )
}

export function subscribeToImagensDaCena(cenaId: string, callback: (imagens: ImagemEquipe[]) => void) {
  return onSnapshot(
    query(collection(db, 'imagensEquipe'), where('cenaId', '==', cenaId)),
    snap => callback(ordenar(snap.docs.map(d => ({ ...d.data(), id: d.id }) as ImagemEquipe))),
    () => callback([]),
  )
}

export interface ImagemEquipeVinculo {
  cenaId?: string
  cenaNome?: string
  legenda?: string
}

export async function uploadImagemEquipe(
  file: File,
  equipe: { id: string; nome: string },
  vinculo: ImagemEquipeVinculo,
  byUid: string,
): Promise<void> {
  const up = await uploadArquivo(`equipes/${equipe.id}/imagens`, file)
  await setDoc(
    doc(db, 'imagensEquipe', up.id),
    semUndefined({
      equipeId: equipe.id,
      equipeNome: equipe.nome,
      url: up.url,
      path: up.path,
      cenaId: vinculo.cenaId,
      cenaNome: vinculo.cenaId ? vinculo.cenaNome : undefined,
      legenda: vinculo.legenda?.trim() || undefined,
      uploadedByUid: byUid,
      uploadedAt: new Date().toISOString(),
    }),
  )
}

export async function updateImagemEquipe(id: string, vinculo: ImagemEquipeVinculo): Promise<void> {
  await updateDoc(doc(db, 'imagensEquipe', id), {
    cenaId: vinculo.cenaId || deleteField(),
    cenaNome: vinculo.cenaId ? vinculo.cenaNome ?? deleteField() : deleteField(),
    legenda: vinculo.legenda?.trim() || deleteField(),
  })
}

export async function deleteImagemEquipe(imagem: ImagemEquipe): Promise<void> {
  await deleteDoc(doc(db, 'imagensEquipe', imagem.id))
  await deleteCenaFile(imagem.path)
}
