import { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { corsDoStorage } from '@/lib/imagem'

interface Props {
  photoURL?: string | null
  name?: string
  className?: string
}

/**
 * Foto do usuário (Google ou escolhida no app), com fallback pras iniciais ou um ícone genérico.
 * Foto do Storage vai com CORS pra ficar no cache do aparelho (ver `corsDoStorage`).
 */
export function Avatar({ photoURL, name, className }: Props) {
  // Foto que não carregou (link expirado, bloqueio, sem internet): cai pras iniciais, em vez do
  // ícone de imagem quebrada. Volta a tentar se o link mudar.
  const [falhou, setFalhou] = useState<string | null>(null)

  if (photoURL && falhou !== photoURL) {
    return (
      <img
        src={photoURL}
        alt={name ?? ''}
        referrerPolicy="no-referrer"
        crossOrigin={corsDoStorage(photoURL)}
        loading="lazy"
        decoding="async"
        onError={() => setFalhou(photoURL)}
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
