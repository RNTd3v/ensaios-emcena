import type { HorarioOracao } from '@/types'

export const DURACOES_ORACAO = [15, 30, 60] as const

/** Rótulos curtos dos dias, índice = `Date.getDay()` (0 = domingo). */
export const DIAS_SEMANA_CURTOS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const DIAS_SEMANA_NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6]

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatMinutos(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** "07:00 – 07:30" */
export function formatFaixa(h: Pick<HorarioOracao, 'inicio' | 'duracaoMin'>): string {
  return `${h.inicio} – ${formatMinutos(paraMinutos(h.inicio) + h.duracaoMin)}`
}

/**
 * Se o horário está acontecendo em `agora`. Um horário que passa da meia-noite (ex.: 23:30 por
 * 60 min) vale pro dia marcado até 00:00 e pro dia seguinte até o fim.
 */
export function estaOrando(h: HorarioOracao, agora: Date): boolean {
  const minAgora = agora.getHours() * 60 + agora.getMinutes()
  const inicio = paraMinutos(h.inicio)
  const fim = inicio + h.duracaoMin
  const hoje = agora.getDay()
  const ontem = (hoje + 6) % 7
  if (h.dias.includes(hoje) && minAgora >= inicio && minAgora < fim) return true
  return fim > 1440 && h.dias.includes(ontem) && minAgora < fim - 1440
}

/** Próximo horário a começar a partir de `agora` (nos próximos 7 dias), com quantos minutos faltam. */
export function proximoHorario(horarios: HorarioOracao[], agora: Date): { horario: HorarioOracao; emMinutos: number } | undefined {
  const minAgora = agora.getHours() * 60 + agora.getMinutes()
  let melhor: { horario: HorarioOracao; emMinutos: number } | undefined
  for (const h of horarios) {
    const inicio = paraMinutos(h.inicio)
    for (let d = 0; d < 7; d++) {
      const dia = (agora.getDay() + d) % 7
      if (!h.dias.includes(dia)) continue
      const em = d * 1440 + inicio - minAgora
      if (em <= 0) continue
      if (!melhor || em < melhor.emMinutos) melhor = { horario: h, emMinutos: em }
      break
    }
  }
  return melhor
}

/** Horários de um dia da semana, ordenados pelo início. */
export function horariosDoDia(horarios: HorarioOracao[], dia: number): HorarioOracao[] {
  return horarios.filter(h => h.dias.includes(dia)).sort((a, b) => a.inicio.localeCompare(b.inicio))
}
