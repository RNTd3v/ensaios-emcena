import { DIA_SEMANA_LABELS, type Elenco } from '@/types'
import { sortDias } from '@/lib/dias'

/** Formata o horário de um elenco pra exibição — comum (um só) ou por dia. */
export function formatElencoHorario(elenco: Pick<Elenco, 'horario' | 'horarios' | 'dias'>): string {
  if (elenco.horario) return elenco.horario
  if (elenco.horarios) {
    return sortDias(elenco.dias)
      .map(d => `${DIA_SEMANA_LABELS[d]} ${elenco.horarios?.[d] ?? '?'}`)
      .join(' · ')
  }
  return ''
}
