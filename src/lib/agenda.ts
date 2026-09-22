import type { DiaSemana } from '@/types'

/** Índice do dia da semana (`Date.getDay()`, 0 = domingo) correspondente a cada `DiaSemana`. */
export const DIA_TO_WEEKDAY: Record<DiaSemana, number> = {
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** As 7 datas (segunda a domingo) da semana que contém `base`. */
export function weekDates(base: Date): Date[] {
  const day = base.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + diffToMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const WEEKDAY_FULL_LABELS: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terça',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sábado',
}

/** "Hoje", "Amanhã", "Próxima terça"... ou a data curta (ex.: "ter, 30/09") se for mais adiante. */
export function formatRelativeDia(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Hoje'
  const date = new Date(`${dateKey}T00:00:00`)
  const today = new Date(`${todayKey}T00:00:00`)
  const diffDays = Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 1) return 'Amanhã'
  if (diffDays > 1 && diffDays < 7) return `Próxima ${WEEKDAY_FULL_LABELS[date.getDay()]}`
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

/**
 * Se o check-in de presença pra um ensaio está liberado agora: só no dia do ensaio, e só até
 * `limiteHoras` antes do horário (ex.: ensaio 19h, limite 2h -> check-in fecha às 17h).
 */
export function canCheckin(ensaioData: string, ensaioHorario: string, limiteHoras: number): boolean {
  const now = new Date()
  if (ensaioData !== toDateKey(now)) return false
  const [h, m] = ensaioHorario.split(':').map(Number)
  const inicio = new Date(now)
  inicio.setHours(h, m, 0, 0)
  const fechaEm = new Date(inicio.getTime() - limiteHoras * 60 * 60 * 1000)
  return now <= fechaEm
}

/**
 * Matriz de semanas (domingo a sábado, como `Date.getDay()`) pro mês `month` (0-indexed) de
 * `year`, com `null` nas células fora do mês.
 */
export function monthMatrix(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
