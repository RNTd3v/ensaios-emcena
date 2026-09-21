import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './config'
import type { DiaSemana, Elenco, UserRole } from '@/types'

export interface ElencoInput {
  nome: string
  participantes: string[]
  liderUid?: string
  dias: DiaSemana[]
  /** Só um de horario/horarios deve vir preenchido — ver Elenco em @/types. */
  horario?: string
  horarios?: Partial<Record<DiaSemana, string>>
  observacao?: string
}

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

function fromSnap(id: string, data: Record<string, unknown>): Elenco {
  return {
    id,
    ...data,
    ativo: data.ativo !== false,
    createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(data.updatedAt),
    deactivatedAt: toIso(data.deactivatedAt),
  } as Elenco
}

export async function createElenco(input: ElencoInput, createdByUid: string): Promise<void> {
  const data: Record<string, unknown> = {
    nome: input.nome,
    participantes: input.participantes,
    dias: input.dias,
    ativo: true,
    createdByUid,
    createdAt: serverTimestamp(),
  }
  if (input.horario) data.horario = input.horario
  if (input.horarios) data.horarios = input.horarios
  if (input.observacao) data.observacao = input.observacao
  if (input.liderUid) data.liderUid = input.liderUid
  await addDoc(collection(db, 'elencos'), data)
}

export async function updateElenco(id: string, input: ElencoInput, updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'elencos', id), {
    nome: input.nome,
    participantes: input.participantes,
    liderUid: input.liderUid || deleteField(),
    dias: input.dias,
    horario: input.horario || deleteField(),
    horarios: input.horarios || deleteField(),
    observacao: input.observacao || deleteField(),
    updatedByUid,
    updatedAt: serverTimestamp(),
  })
}

/** "Excluir" um elenco: soft delete. Admin ou o líder do próprio elenco podem desativar. */
export async function deactivateElenco(id: string, deactivatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'elencos', id), {
    ativo: false,
    deactivatedByUid,
    deactivatedAt: serverTimestamp(),
  })
}

/** Só admin reativa (garantido também pelas firestore.rules). */
export async function reactivateElenco(id: string, reactivatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'elencos', id), {
    ativo: true,
    deactivatedByUid: deleteField(),
    deactivatedAt: deleteField(),
    updatedByUid: reactivatedByUid,
    updatedAt: serverTimestamp(),
  })
}

/** Exclusão de verdade, sem volta — só admin (garantido pelas firestore.rules). */
export async function deleteElencoPermanently(id: string): Promise<void> {
  await deleteDoc(doc(db, 'elencos', id))
}

/**
 * Admin vê todos os elencos (ativos e inativos); líder só os que ele lidera (regra do Firestore
 * exige o filtro `where('liderUid', '==', uid)` pra permitir a query — ver firestore.rules).
 * Filtrar por ativo/inativo é responsabilidade de quem consome a lista.
 */
export function subscribeToElencos(role: UserRole, uid: string, callback: (elencos: Elenco[]) => void) {
  const q =
    role === 'admin'
      ? query(collection(db, 'elencos'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'elencos'), where('liderUid', '==', uid))
  return onSnapshot(q, snap => {
    const elencos = snap.docs.map(d => fromSnap(d.id, d.data()))
    if (role !== 'admin') elencos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    callback(elencos)
  })
}
