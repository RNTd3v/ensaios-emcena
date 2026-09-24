import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './config'
import type { HorarioOracao, OracaoConfig, PedidoOracao } from '@/types'

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

// ---------- Config (líder, assistentes, orientações) ----------

const CONFIG_REF = doc(db, 'oracao', 'config')

export function subscribeToOracaoConfig(callback: (config: OracaoConfig) => void) {
  return onSnapshot(
    CONFIG_REF,
    snap => callback((snap.exists() ? snap.data() : {}) as OracaoConfig),
    () => callback({}),
  )
}

/** Só admin define quem lidera (garantido pelas firestore.rules). */
export async function saveOracaoEquipe(liderUid: string | undefined, assistentes: string[]): Promise<void> {
  await setDoc(CONFIG_REF, { liderUid: liderUid ?? null, assistentes, updatedAt: serverTimestamp() }, { merge: true })
}

/** Admin, líder ou assistente da oração. */
export async function saveOracaoOrientacoes(orientacoes: string): Promise<void> {
  await setDoc(CONFIG_REF, { orientacoes: orientacoes.trim() || deleteField(), updatedAt: serverTimestamp() }, { merge: true })
}

// ---------- Horários (um por pessoa) ----------

export function subscribeToHorariosOracao(callback: (horarios: HorarioOracao[]) => void) {
  return onSnapshot(
    collection(db, 'horariosOracao'),
    snap =>
      callback(
        snap.docs.map(d => {
          const data = d.data()
          return { ...data, uid: d.id, updatedAt: toIso(data.updatedAt) } as HorarioOracao
        }),
      ),
    () => callback([]),
  )
}

export async function saveHorarioOracao(uid: string, horario: Omit<HorarioOracao, 'uid' | 'updatedAt'>): Promise<void> {
  await setDoc(doc(db, 'horariosOracao', uid), { ...horario, updatedAt: serverTimestamp() })
}

export async function deleteHorarioOracao(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'horariosOracao', uid))
}

// ---------- Pedidos de oração ----------

export function subscribeToPedidosOracao(callback: (pedidos: PedidoOracao[]) => void) {
  return onSnapshot(
    collection(db, 'pedidosOracao'),
    snap => {
      const pedidos = snap.docs.map(d => {
        const data = d.data()
        return { ...data, id: d.id, createdAt: toIso(data.createdAt) ?? new Date().toISOString() } as PedidoOracao
      })
      callback(pedidos.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    },
    () => callback([]),
  )
}

export async function createPedidoOracao(input: { titulo?: string; texto: string }, createdByUid: string): Promise<void> {
  await addDoc(collection(db, 'pedidosOracao'), {
    texto: input.texto.trim(),
    ...(input.titulo?.trim() ? { titulo: input.titulo.trim() } : {}),
    respondido: false,
    createdByUid,
    createdAt: serverTimestamp(),
  })
}

export async function updatePedidoOracao(id: string, input: { titulo?: string; texto: string; respondido?: boolean }): Promise<void> {
  await updateDoc(doc(db, 'pedidosOracao', id), {
    texto: input.texto.trim(),
    titulo: input.titulo?.trim() || deleteField(),
    respondido: !!input.respondido,
  })
}

export async function deletePedidoOracao(id: string): Promise<void> {
  await deleteDoc(doc(db, 'pedidosOracao', id))
}
