import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './config'
import type { AnotacaoMusica } from '@/types'

const COL = 'anotacoesMusica'

function fromSnap(id: string, data: Record<string, unknown>): AnotacaoMusica {
  const createdAt = data.createdAt as { toDate?: () => Date } | undefined
  return {
    ...data,
    id,
    global: !!data.global,
    createdAt: createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
  } as AnotacaoMusica
}

function assinar(q: ReturnType<typeof query>, callback: (lista: AnotacaoMusica[]) => void) {
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => fromSnap(d.id, d.data() as Record<string, unknown>))),
    () => callback([]),
  )
}

/** Anotações das músicas de uma cena (as globais dela também). */
export function subscribeToAnotacoesDaCena(cenaId: string, callback: (lista: AnotacaoMusica[]) => void) {
  return assinar(query(collection(db, COL), where('cenaId', '==', cenaId)), callback)
}

/** Só as marcadas como globais — página de músicas e equipe de sonoplastia. */
export function subscribeToAnotacoesGlobais(callback: (lista: AnotacaoMusica[]) => void) {
  return assinar(query(collection(db, COL), where('global', '==', true)), callback)
}

export interface AnotacaoInput {
  musicaId: string
  cenaId: string
  cenaNome?: string
  ensaioId?: string
  ensaioData?: string
  tempoSeg: number
  texto: string
  global: boolean
}

export async function criarAnotacao(input: AnotacaoInput, autorUid: string): Promise<void> {
  await addDoc(collection(db, COL), {
    musicaId: input.musicaId,
    cenaId: input.cenaId,
    ...(input.cenaNome ? { cenaNome: input.cenaNome } : {}),
    ...(input.ensaioId ? { ensaioId: input.ensaioId, ensaioData: input.ensaioData ?? '' } : {}),
    tempoSeg: Math.max(0, Math.round(input.tempoSeg)),
    texto: input.texto.trim(),
    global: input.global,
    autorUid,
    createdAt: serverTimestamp(),
  })
}

export async function editarAnotacao(
  id: string,
  dados: Pick<AnotacaoInput, 'tempoSeg' | 'texto' | 'global'>,
  byUid: string,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    tempoSeg: Math.max(0, Math.round(dados.tempoSeg)),
    texto: dados.texto.trim(),
    global: dados.global,
    updatedByUid: byUid,
    updatedAt: serverTimestamp(),
  })
}

export async function excluirAnotacao(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

/** Todas as anotações de uma música, de qualquer cena (ex.: pra perguntar ao trocar o arquivo). */
export async function getAnotacoesDaMusica(musicaId: string): Promise<AnotacaoMusica[]> {
  const snap = await getDocs(query(collection(db, COL), where('musicaId', '==', musicaId)))
  return snap.docs.map(d => fromSnap(d.id, d.data() as Record<string, unknown>))
}

export async function excluirAnotacoes(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 400)) batch.delete(doc(db, COL, id))
    await batch.commit()
  }
}

/** "115" -> "1:55". */
export function formatTempo(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "1:55" ou "115" -> 115; inválido -> null. */
export function parseTempo(texto: string): number | null {
  const t = texto.trim()
  const m = t.match(/^(\d+):([0-5]?\d)$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  return /^\d+$/.test(t) ? Number(t) : null
}
