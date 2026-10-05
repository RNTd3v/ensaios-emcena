import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Notificar o elenco" ao alterar/cancelar um ensaio. Desmarcado, a Cloud Function não manda
 * notificação — o elenco vê a mudança só pelo app.
 */
export function NotificarElenco({ value, onChange, className }: { value: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn('flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs', value ? 'border-primary/40 bg-primary/5' : 'border-gray-200 bg-white', className)}
    >
      {value ? <Bell className="h-4 w-4 shrink-0 text-primary" /> : <BellOff className="h-4 w-4 shrink-0 text-gray-400" />}
      <span className="min-w-0 flex-1">
        <span className={cn('block font-medium', value ? 'text-gray-900' : 'text-gray-600')}>
          {value ? 'Notificar o elenco' : 'Sem notificação'}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {value ? 'Todos da cena recebem o aviso.' : 'Ninguém recebe aviso — a mudança aparece só no app.'}
        </span>
      </span>
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', value ? 'bg-primary' : 'bg-gray-300')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', value ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}
