import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './config'
import type { Equipe } from '@/types'

function fromSnap(id: string, data: Record<string, unknown>): Equipe {
  return {
    id,
    nome: data.nome as string,
    icone: data.icone as string | undefined,
    descricao: data.descricao as string | undefined,
    liderUid: (data.liderUid as string | null) ?? undefined,
    assistentes: (data.assistentes as string[]) ?? [],
    membros: (data.membros as string[]) ?? [],
    gerencia: (data.gerencia as Equipe['gerencia']) ?? [],
    prazoFigurino: data.prazoFigurino as string | undefined,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString(),
  }
}

export function subscribeToEquipes(callback: (equipes: Equipe[]) => void) {
  return onSnapshot(
    collection(db, 'equipes'),
    snap => callback(snap.docs.map(d => fromSnap(d.id, d.data())).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))),
    () => callback([]),
  )
}

export function subscribeToEquipe(id: string, callback: (equipe: Equipe | null) => void) {
  return onSnapshot(
    doc(db, 'equipes', id),
    snap => callback(snap.exists() ? fromSnap(snap.id, snap.data()) : null),
    () => callback(null),
  )
}

/** Só admin (garantido pelas firestore.rules). Retorna o id criado. */
export async function createEquipe(input: {
  nome: string
  icone?: string
  descricao?: string
  gerencia?: Equipe['gerencia']
}): Promise<string> {
  const ref = await addDoc(collection(db, 'equipes'), {
    nome: input.nome.trim(),
    gerencia: input.gerencia ?? [],
    ...(input.icone ? { icone: input.icone } : {}),
    ...(input.descricao?.trim() ? { descricao: input.descricao.trim() } : {}),
    assistentes: [],
    membros: [],
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function createEquipes(inputs: { nome: string; icone: string; gerencia?: Equipe['gerencia'] }[]): Promise<void> {
  const batch = writeBatch(db)
  for (const e of inputs) {
    batch.set(doc(collection(db, 'equipes')), { ...e, gerencia: e.gerencia ?? [], assistentes: [], membros: [], createdAt: serverTimestamp() })
  }
  await batch.commit()
}

/**
 * Dados gerais da equipe. Nome, ícone e líder só admin muda; a descrição o líder também
 * (as firestore.rules garantem). Quem vira líder entra em `membros` e sai de `assistentes`.
 */
export async function updateEquipeInfo(
  equipe: Equipe,
  input: { nome: string; icone?: string; descricao?: string; liderUid?: string; gerencia?: Equipe['gerencia'] },
): Promise<void> {
  const data: Record<string, unknown> = {
    nome: input.nome.trim(),
    gerencia: input.gerencia ?? [],
    icone: input.icone || deleteField(),
    descricao: input.descricao?.trim() || deleteField(),
  }
  if (input.liderUid !== equipe.liderUid) {
    data.liderUid = input.liderUid ?? deleteField()
    if (input.liderUid) {
      data.membros = equipe.membros.includes(input.liderUid) ? equipe.membros : [...equipe.membros, input.liderUid]
      data.assistentes = equipe.assistentes.filter(a => a !== input.liderUid)
    }
  }
  await updateDoc(doc(db, 'equipes', equipe.id), data)
}

/** Prazo de envio da foto do figurino (equipe de figurino) — admin, líder ou assistente da equipe. */
export async function updateEquipePrazoFigurino(id: string, prazo: string): Promise<void> {
  await updateDoc(doc(db, 'equipes', id), { prazoFigurino: prazo || deleteField() })
}

/** Só a descrição — o que o líder (não admin) pode editar. */
export async function updateEquipeDescricao(id: string, descricao: string): Promise<void> {
  await updateDoc(doc(db, 'equipes', id), { descricao: descricao.trim() || deleteField() })
}

/** Membros e assistentes (assistentes sempre ⊆ membros) — admin ou líder da equipe. */
export async function updateEquipePessoas(id: string, membros: string[], assistentes: string[]): Promise<void> {
  await updateDoc(doc(db, 'equipes', id), { membros, assistentes: assistentes.filter(a => membros.includes(a)) })
}

export async function deleteEquipe(id: string): Promise<void> {
  await deleteDoc(doc(db, 'equipes', id))
}
