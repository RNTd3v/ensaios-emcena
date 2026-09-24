import { Ban, CheckCircle2, Circle, CircleDashed, OctagonAlert, type LucideIcon } from 'lucide-react'
import type { TarefaStatus } from '@/types'

export const TAREFA_STATUS: { value: TarefaStatus; label: string; icon: LucideIcon; className: string }[] = [
  { value: 'a_fazer', label: 'A fazer', icon: Circle, className: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'fazendo', label: 'Fazendo', icon: CircleDashed, className: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'bloqueado', label: 'Bloqueado', icon: OctagonAlert, className: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'feito', label: 'Feito', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'cancelado', label: 'Cancelado', icon: Ban, className: 'bg-red-100 text-red-700 border-red-200' },
]

export function statusInfo(status: TarefaStatus) {
  return TAREFA_STATUS.find(s => s.value === status) ?? TAREFA_STATUS[0]
}

/** Status que só podem ser escolhidos com uma justificativa (as firestore.rules também exigem). */
export const STATUS_COM_JUSTIFICATIVA: TarefaStatus[] = ['bloqueado', 'cancelado']

export function exigeJustificativa(status: TarefaStatus): boolean {
  return STATUS_COM_JUSTIFICATIVA.includes(status)
}

/** Tarefa ainda em andamento (conta pra "abertas" e pra prazo vencido). */
export function estaAberta(status: TarefaStatus): boolean {
  return status === 'a_fazer' || status === 'fazendo' || status === 'bloqueado'
}
