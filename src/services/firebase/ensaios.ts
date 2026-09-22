import { addDoc, arrayUnion, collection, deleteField, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from './config'
import type { Ensaio } from '@/types'

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

function fromSnap(id: string, data: Record<string, unknown>): Ensaio {
  return {
    id,
    ...data,
    presencas: (data.presencas as string[]) ?? [],
    confirmedAt: toIso(data.confirmedAt) ?? new Date().toISOString(),
    canceledAt: toIso(data.canceledAt),
    createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
  } as Ensaio
}

export async function createEnsaio(
  cenaId: string,
  data: string,
  horario: string,
  confirmedByUid: string,
  obrigatorios?: string[],
  flags?: { geral?: boolean; comFigurino?: boolean },
): Promise<void> {
  await addDoc(collection(db, 'ensaios'), {
    cenaId,
    data,
    horario,
    presencas: [],
    ...(obrigatorios?.length ? { obrigatorios } : {}),
    ...(flags?.geral ? { geral: true } : {}),
    ...(flags?.comFigurino ? { comFigurino: true } : {}),
    confirmedByUid,
    confirmedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
}

/** Define quais personagens têm presença obrigatória nesse ensaio específico. */
export async function updateEnsaioObrigatorios(id: string, personagemIds: string[]): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), personagemIds.length ? { obrigatorios: personagemIds } : { obrigatorios: deleteField() })
}

/** Corrige o horário de um ensaio já confirmado. */
export async function updateEnsaioHorario(id: string, horario: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { horario })
}

/** Marca/desmarca as flags "ensaio geral" e "ensaio com figurino" desse ensaio. */
export async function updateEnsaioFlags(id: string, flags: { geral: boolean; comFigurino: boolean }): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), {
    geral: flags.geral || deleteField(),
    comFigurino: flags.comFigurino || deleteField(),
  })
}

/** Cancela um ensaio confirmado — mantém o registro (pra mostrar "cancelado por Fulano"), não apaga. */
export async function cancelarEnsaio(id: string, canceledByUid: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { canceledByUid, canceledAt: serverTimestamp() })
}

/** Reconfirma um ensaio cancelado — limpa o cancelamento e reinicia as presenças confirmadas. */
export async function reconfirmarEnsaio(id: string, confirmedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), {
    canceledByUid: deleteField(),
    canceledAt: deleteField(),
    presencas: [],
    confirmedByUid,
    confirmedAt: serverTimestamp(),
  })
}

/** Confirma a presença de `uid` (elenco com personagem na cena) nesse ensaio. */
export async function confirmarPresenca(id: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { presencas: arrayUnion(uid) })
}

/** Todos os ensaios (confirmados e cancelados) de uma cena, em tempo real — sem paginação. */
export function subscribeToEnsaiosDaCena(cenaId: string, callback: (ensaios: Ensaio[]) => void) {
  const q = query(collection(db, 'ensaios'), where('cenaId', '==', cenaId))
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromSnap(d.id, d.data()))))
}
