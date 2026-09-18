import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  photoURL?: string | null
  name?: string
  className?: string
}

/** Foto do usuário (Google), com fallback pras iniciais ou um ícone genérico. */
export function Avatar({ photoURL, name, className }: Props) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name ?? ''}
        referrerPolicy="no-referrer"
        className={cn('rounded-full object-cover shrink-0', className)}
      />
    )
  }

  const initial = name?.trim()?.[0]?.toUpperCase()

  return (
    <div
      className={cn(
        'rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0',
        className,
      )}
    >
      {initial ?? <User className="h-1/2 w-1/2" />}
    </div>
  )
}
