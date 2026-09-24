import { CalendarCheck, CheckCircle2, CircleDashed, CircleHelp, Clock, XCircle } from 'lucide-react'
import { ENSAIO_STATUS_LABELS, type EnsaioStatus } from '@/lib/ensaioStatus'
import { cn } from '@/lib/utils'

const STYLES: Record<EnsaioStatus, { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  realizado: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  hoje: { className: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  confirmado: { className: 'bg-primary/10 text-primary border-primary/30', icon: CalendarCheck },
  semRegistro: { className: 'bg-amber-100 text-amber-700 border-amber-200', icon: CircleHelp },
  cancelado: { className: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  naoConfirmado: { className: 'bg-gray-100 text-gray-500 border-gray-200', icon: CircleDashed },
}

export function EnsaioStatusChip({ status, className }: { status: EnsaioStatus; className?: string }) {
  const { className: styleClass, icon: Icon } = STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        styleClass,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {ENSAIO_STATUS_LABELS[status]}
    </span>
  )
}
