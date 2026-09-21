import { DIA_SEMANA_LABELS, type DiaSemana } from '@/types'

export const DIAS_ORDER = Object.keys(DIA_SEMANA_LABELS) as DiaSemana[]

export function sortDias(dias: DiaSemana[]): DiaSemana[] {
  return [...dias].sort((a, b) => DIAS_ORDER.indexOf(a) - DIAS_ORDER.indexOf(b))
}
