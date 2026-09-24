import { DIA_SEMANA_LABELS, type DiaSemana } from '@/types'

export const DIAS_ORDER = Object.keys(DIA_SEMANA_LABELS) as DiaSemana[]

export function sortDias(dias: DiaSemana[]): DiaSemana[] {
  return [...dias].sort((a, b) => DIAS_ORDER.indexOf(a) - DIAS_ORDER.indexOf(b))
}

/**
 * Dias em que todo mundo precisa estar disponível, independente do que marcou na inscrição
 * (sábado virou obrigatório). Toda checagem de disponibilidade deve passar por `diasDisponiveis`.
 */
export const DIAS_OBRIGATORIOS: DiaSemana[] = ['sab']

/** A disponibilidade efetiva de alguém: os dias que marcou + os obrigatórios. */
export function diasDisponiveis(dias: DiaSemana[]): DiaSemana[] {
  return sortDias([...new Set([...dias, ...DIAS_OBRIGATORIOS])])
}
