import type { Ensaio } from '@/types'

export type EnsaioStatus = 'realizado' | 'hoje' | 'confirmado' | 'semRegistro' | 'cancelado' | 'naoConfirmado'

export const ENSAIO_STATUS_LABELS: Record<EnsaioStatus, string> = {
  realizado: 'Realizado',
  hoje: 'Hoje',
  confirmado: 'Confirmado',
  semRegistro: 'Sem registro',
  cancelado: 'Cancelado',
  naoConfirmado: 'Não confirmado',
}

/**
 * Status de um ensaio pra exibição. `undefined` = ainda não existe documento (só previsto pela
 * agenda da cena) → "não confirmado". Data passada sem ter sido finalizado → "sem registro".
 */
export function ensaioStatus(ensaio: Ensaio | undefined, todayKey: string): EnsaioStatus {
  if (!ensaio) return 'naoConfirmado'
  if (ensaio.canceledByUid) return 'cancelado'
  if (ensaio.finalizadoAt) return 'realizado'
  if (ensaio.data === todayKey) return 'hoje'
  if (ensaio.data < todayKey) return 'semRegistro'
  return 'confirmado'
}
