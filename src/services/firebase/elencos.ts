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

function fromSnap(id: string, data: Record<string, unknown>): Elenco {
  return {
    id,
    ...data,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString(),
  } as Elenco
}

export async function createElenco(input: ElencoInput): Promise<void> {
  const data: Record<string, unknown> = {
    nome: input.nome,
    participantes: input.participantes,
    dias: input.dias,
    createdAt: serverTimestamp(),
  }
  if (input.horario) data.horario = input.horario
  if (input.horarios) data.horarios = input.horarios
  if (input.observacao) data.observacao = input.observacao
  if (input.liderUid) data.liderUid = input.liderUid
  await addDoc(collection(db, 'elencos'), data)
}

export async function updateElenco(id: string, input: ElencoInput): Promise<void> {
  await updateDoc(doc(db, 'elencos', id), {
    nome: input.nome,
    participantes: input.participantes,
    liderUid: input.liderUid || deleteField(),
    dias: input.dias,
    horario: input.horario || deleteField(),
    horarios: input.horarios || deleteField(),
    observacao: input.observacao || deleteField(),
  })
}

export async function deleteElenco(id: string): Promise<void> {
  await deleteDoc(doc(db, 'elencos', id))
}

/**
 * Admin vê todos os elencos; líder só os que ele lidera (regra do Firestore exige o filtro
 * `where('liderUid', '==', uid)` pra permitir a query — ver firestore.rules).
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
