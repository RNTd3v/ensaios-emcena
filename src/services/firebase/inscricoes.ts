import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './config'
import type { Inscricao, InscricaoStatus } from '@/types'

/**
 * Firestore rejeita `undefined` em campos — remove essas chaves recursivamente antes de salvar.
 * Só recursa em objetos literais simples; deixa instâncias especiais (ex: FieldValue do
 * serverTimestamp()) intactas, senão elas perdem o comportamento interno do Firestore.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as T
  }
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
    return Object.fromEntries(entries) as T
  }
  return value
}

function fromSnap(data: Record<string, unknown>): Inscricao {
  return {
    ...data,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: (data.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.().toISOString(),
  } as Inscricao
}

export async function getInscricao(uid: string): Promise<Inscricao | null> {
  const snap = await getDoc(doc(db, 'inscricoes', uid))
  if (!snap.exists()) return null
  return fromSnap(snap.data())
}

export type InscricaoInput = Omit<Inscricao, 'createdAt' | 'updatedAt' | 'status'>

export async function saveInscricao(input: InscricaoInput, isNew: boolean): Promise<void> {
  const ref = doc(db, 'inscricoes', input.uid)
  await setDoc(
    ref,
    stripUndefined({
      ...input,
      ...(isNew ? { status: 'pendente', createdAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  )
}

export function subscribeToAllInscricoes(callback: (inscricoes: Inscricao[]) => void) {
  const q = query(collection(db, 'inscricoes'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => fromSnap(d.data())))
  })
}

export async function getAllInscricoesOnce(): Promise<Inscricao[]> {
  const snap = await getDocs(collection(db, 'inscricoes'))
  return snap.docs.map(d => fromSnap(d.data()))
}

export async function updateInscricaoStatus(uid: string, status: InscricaoStatus): Promise<void> {
  await updateDoc(doc(db, 'inscricoes', uid), { status, updatedAt: serverTimestamp() })
}
