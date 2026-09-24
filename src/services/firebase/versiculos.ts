import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './config'
import type { Versiculo } from '@/types'

export interface VersiculoInput {
  texto: string
  referencia: string
}

function fromData(id: string, data: Record<string, unknown>): Versiculo {
  return {
    id,
    texto: data.texto as string,
    referencia: data.referencia as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString(),
  }
}

/** Todos os versículos, em tempo real — usado na tela do admin. */
export function subscribeToVersiculos(callback: (versiculos: Versiculo[]) => void) {
  return onSnapshot(collection(db, 'versiculos'), snap => {
    const lista = snap.docs.map(d => fromData(d.id, d.data()))
    callback(lista.sort((a, b) => a.referencia.localeCompare(b.referencia, 'pt-BR', { numeric: true })))
  })
}

/** Leitura única — a Home sorteia um e não fica ouvindo mudanças (o versículo não troca na frente da pessoa). */
export async function getVersiculos(): Promise<Versiculo[]> {
  const snap = await getDocs(collection(db, 'versiculos'))
  return snap.docs.map(d => fromData(d.id, d.data()))
}

export async function createVersiculo(input: VersiculoInput): Promise<void> {
  await addDoc(collection(db, 'versiculos'), {
    texto: input.texto.trim(),
    referencia: input.referencia.trim(),
    createdAt: serverTimestamp(),
  })
}

export async function updateVersiculo(id: string, input: VersiculoInput): Promise<void> {
  await updateDoc(doc(db, 'versiculos', id), { texto: input.texto.trim(), referencia: input.referencia.trim() })
}

export async function deleteVersiculo(id: string): Promise<void> {
  await deleteDoc(doc(db, 'versiculos', id))
}

/** Cadastra vários de uma vez (tudo ou nada) — usado pra carregar os versículos sugeridos. */
export async function createVersiculos(inputs: VersiculoInput[]): Promise<void> {
  const batch = writeBatch(db)
  for (const v of inputs) {
    batch.set(doc(collection(db, 'versiculos')), {
      texto: v.texto.trim(),
      referencia: v.referencia.trim(),
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
}
