import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from './config'
import type { AnotacaoCena, AnotacaoVisibilidade } from '@/types'

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

function anotacoesRef(cenaId: string) {
  return collection(db, 'cenas', cenaId, 'anotacoes')
}

/**
 * Anotações avulsas do diário da cena, em tempo real. A liderança vê todas; o elenco só as
 * marcadas `elenco` (a regra exige o filtro na consulta).
 */
export function subscribeToAnotacoesCena(cenaId: string, todas: boolean, callback: (anotacoes: AnotacaoCena[]) => void) {
  const q = todas ? anotacoesRef(cenaId) : query(anotacoesRef(cenaId), where('visibilidade', '==', 'elenco'))
  return onSnapshot(
    q,
    snap =>
      callback(
        snap.docs.map(d => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            // Gravação local ainda sem o horário do servidor: usa agora.
            createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
            updatedAt: toIso(data.updatedAt),
          } as AnotacaoCena
        }),
      ),
    () => callback([]),
  )
}

export interface AnotacaoCenaInput {
  titulo: string
  texto: string
  visibilidade: AnotacaoVisibilidade
}

export async function criarAnotacaoCena(cenaId: string, input: AnotacaoCenaInput, autorUid: string): Promise<void> {
  await addDoc(anotacoesRef(cenaId), {
    titulo: input.titulo.trim(),
    texto: input.texto.trim(),
    visibilidade: input.visibilidade,
    autorUid,
    createdAt: serverTimestamp(),
  })
}

export async function atualizarAnotacaoCena(cenaId: string, id: string, input: AnotacaoCenaInput): Promise<void> {
  await updateDoc(doc(db, 'cenas', cenaId, 'anotacoes', id), {
    titulo: input.titulo.trim(),
    texto: input.texto.trim(),
    visibilidade: input.visibilidade,
    updatedAt: serverTimestamp(),
  })
}

export async function excluirAnotacaoCena(cenaId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'cenas', cenaId, 'anotacoes', id))
}
