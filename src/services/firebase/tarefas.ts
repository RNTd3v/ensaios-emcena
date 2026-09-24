import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './config'
import { exigeJustificativa } from '@/lib/tarefas'
import type { Tarefa, TarefaStatus } from '@/types'

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

function tarefasCol(equipeId: string) {
  return collection(db, 'equipes', equipeId, 'tarefas')
}

export function subscribeToTarefas(equipeId: string, callback: (tarefas: Tarefa[]) => void) {
  return onSnapshot(
    tarefasCol(equipeId),
    snap =>
      callback(
        snap.docs.map(d => {
          const data = d.data()
          return {
            ...data,
            id: d.id,
            equipeId,
            createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
            statusAtualizadoEm: toIso(data.statusAtualizadoEm),
          } as Tarefa
        }),
      ),
    () => callback([]),
  )
}

export interface TarefaInput {
  titulo: string
  descricao?: string
  status: TarefaStatus
  justificativa?: string
  responsavelUid?: string
  prazo?: string
  cenaId?: string
  cenaNome?: string
}

function limpar(input: TarefaInput, paraUpdate: boolean) {
  const vazio = paraUpdate ? deleteField() : undefined
  const data: Record<string, unknown> = {
    titulo: input.titulo.trim(),
    status: input.status,
    descricao: input.descricao?.trim() || vazio,
    justificativa: exigeJustificativa(input.status) ? input.justificativa?.trim() : vazio,
    responsavelUid: input.responsavelUid || vazio,
    prazo: input.prazo || vazio,
    cenaId: input.cenaId || vazio,
    cenaNome: input.cenaId ? input.cenaNome : vazio,
  }
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
}

/** Admin, líder ou assistente da equipe. */
export async function createTarefa(equipeId: string, input: TarefaInput, byUid: string): Promise<void> {
  await addDoc(tarefasCol(equipeId), {
    ...limpar(input, false),
    createdByUid: byUid,
    createdAt: serverTimestamp(),
    statusAtualizadoPorUid: byUid,
    statusAtualizadoEm: serverTimestamp(),
  })
}

/** Admin, líder ou assistente da equipe — edição completa. */
export async function updateTarefa(tarefa: Tarefa, input: TarefaInput, byUid: string): Promise<void> {
  const data = limpar(input, true)
  if (input.status !== tarefa.status || (input.justificativa ?? '') !== (tarefa.justificativa ?? '')) {
    data.statusAtualizadoPorUid = byUid
    data.statusAtualizadoEm = serverTimestamp()
  }
  await updateDoc(doc(tarefasCol(tarefa.equipeId), tarefa.id), data)
}

/** Qualquer membro da equipe — só o status (e a justificativa, quando o status exige). */
export async function updateTarefaStatus(
  tarefa: Pick<Tarefa, 'id' | 'equipeId'>,
  status: TarefaStatus,
  justificativa: string | undefined,
  byUid: string,
): Promise<void> {
  await updateDoc(doc(tarefasCol(tarefa.equipeId), tarefa.id), {
    status,
    justificativa: exigeJustificativa(status) ? (justificativa ?? '').trim() : deleteField(),
    statusAtualizadoPorUid: byUid,
    statusAtualizadoEm: serverTimestamp(),
  })
}

export async function deleteTarefa(tarefa: Pick<Tarefa, 'id' | 'equipeId'>): Promise<void> {
  await deleteDoc(doc(tarefasCol(tarefa.equipeId), tarefa.id))
}
