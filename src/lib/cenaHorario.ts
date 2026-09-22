import { DIA_SEMANA_LABELS, type Cena, type DiaSemana } from '@/types'
import { sortDias } from '@/lib/dias'

/** Formata um horário "HH:mm" no jeito informal br: "19:00" -> "19h", "19:30" -> "19h30". */
export function formatHoraCompacta(horario: string): string {
  const [h, m] = horario.split(':')
  const hora = parseInt(h, 10)
  return m === '00' ? `${hora}h` : `${hora}h${m}`
}

/** O horário de um dia específico da cena (por dia se houver, senão o comum). */
export function horarioDoDia(cena: Pick<Cena, 'horario' | 'horarios'>, dia: DiaSemana): string | undefined {
  return cena.horarios?.[dia] ?? cena.horario
}

/** Formata o horário de uma cena pra exibição — comum (um só) ou por dia. */
export function formatCenaHorario(cena: Pick<Cena, 'horario' | 'horarios' | 'dias'>): string {
  if (cena.horario) return cena.horario
  if (cena.horarios) {
    return sortDias(cena.dias)
      .map(d => `${DIA_SEMANA_LABELS[d]} ${cena.horarios?.[d] ?? '?'}`)
      .join(' · ')
  }
  return ''
}
