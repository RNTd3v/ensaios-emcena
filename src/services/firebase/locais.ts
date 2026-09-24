import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './config'
import type { LocalEnsaio } from '@/types'

export interface LocalInput {
  nome: string
  endereco?: string
  observacao?: string
  icone?: string
}

/** Locais de ensaio cadastrados (só admin escreve — ver firestore.rules), em ordem alfabética. */
export function subscribeToLocais(callback: (locais: LocalEnsaio[]) => void) {
  return onSnapshot(collection(db, 'locais'), snap => {
    const locais = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        nome: data.nome,
        endereco: data.endereco,
        observacao: data.observacao,
        icone: data.icone,
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString(),
      } as LocalEnsaio
    })
    callback(locais.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
  })
}

export async function createLocal(input: LocalInput): Promise<void> {
  await addDoc(collection(db, 'locais'), {
    nome: input.nome.trim(),
    ...(input.endereco?.trim() ? { endereco: input.endereco.trim() } : {}),
    ...(input.observacao?.trim() ? { observacao: input.observacao.trim() } : {}),
    ...(input.icone ? { icone: input.icone } : {}),
    createdAt: serverTimestamp(),
  })
}

export async function updateLocal(id: string, input: LocalInput): Promise<void> {
  await updateDoc(doc(db, 'locais', id), {
    nome: input.nome.trim(),
    endereco: input.endereco?.trim() || deleteField(),
    observacao: input.observacao?.trim() || deleteField(),
    icone: input.icone || deleteField(),
  })
}

export async function deleteLocal(id: string): Promise<void> {
  await deleteDoc(doc(db, 'locais', id))
}

/** Link do Google Maps pra um endereço (ou nome, se não tiver endereço). */
export function mapsLink(local: Pick<LocalEnsaio, 'nome' | 'endereco'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(local.endereco || local.nome)}`
}
