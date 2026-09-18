import { useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface Props {
  value: string[] // datas no formato YYYY-MM-DD
  onChange: (dates: string[]) => void
  /** Intervalo permitido pra seleção. Por enquanto fixo aqui; no futuro vira parametrizável pelo admin. */
  minDate?: Date
  maxDate?: Date
}

/** Calendário simples pra selecionar várias datas soltas (ex: dias em que a pessoa NÃO pode). */
export function DateMultiSelect({
  value,
  onChange,
  minDate = new Date(2026, 9, 1), // 1/10/2026
  maxDate = new Date(2027, 0, 31), // 31/01/2027
}: Props) {
  const [month, setMonth] = useState(() => startOfMonth(minDate))

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start, end })

  const canGoPrev = isAfter(startOfMonth(month), startOfMonth(minDate))
  const canGoNext = isBefore(startOfMonth(month), startOfMonth(maxDate))

  function toggle(day: Date) {
    if (isBefore(day, minDate) || isAfter(day, maxDate)) return
    const iso = format(day, 'yyyy-MM-dd')
    onChange(value.includes(iso) ? value.filter(d => d !== iso) : [...value, iso])
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => canGoPrev && setMonth(m => subMonths(m, 1))}
          disabled={!canGoPrev}
          className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-base font-medium capitalize text-gray-900">{format(month, 'MMMM yyyy', { locale: ptBR })}</p>
        <button
          type="button"
          onClick={() => canGoNext && setMonth(m => addMonths(m, 1))}
          disabled={!canGoNext}
          className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map(day => {
          const iso = format(day, 'yyyy-MM-dd')
          const selected = value.includes(iso)
          const inMonth = isSameMonth(day, month)
          const outOfRange = isBefore(day, minDate) || isAfter(day, maxDate)
          return (
            <button
              key={iso}
              type="button"
              disabled={outOfRange}
              onClick={() => toggle(day)}
              className={cn(
                'aspect-square rounded-lg text-sm flex items-center justify-center transition-colors',
                outOfRange && 'text-gray-300 pointer-events-none',
                !outOfRange && !inMonth && 'text-gray-300',
                !outOfRange && inMonth && !selected && 'text-gray-700 hover:bg-gray-200',
                selected && 'bg-primary text-primary-foreground font-medium',
                !outOfRange && inMonth && isToday(day) && !selected && 'border border-gray-400',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
