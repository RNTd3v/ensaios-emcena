import type { ReactNode } from 'react'
import { PhoneMockup } from '@/components/layout/PhoneMockup'
import { cn } from '@/lib/utils'

interface Props {
  heroImageUrl?: string
  heroImageDesktopUrl?: string
  heroAlt: string
  /** Mostrado no lugar da imagem quando não há heroImageUrl configurado. */
  fallback?: ReactNode
  /** Conteúdo do card, sobreposto à imagem de fundo. */
  children: ReactNode
  cardClassName?: string
}

/**
 * Layout compartilhado das telas públicas: imagem cobrindo 100% do container como fundo, com o
 * card centralizado por cima. Usa a mesma moldura de iPhone (`PhoneMockup`) das telas logadas,
 * pra manter a identidade visual consistente em todo o app.
 */
export function PublicHero({ heroImageUrl, heroAlt, fallback, children, cardClassName }: Props) {
  return (
    <PhoneMockup>
      <div className="relative flex-1">
        {heroImageUrl ? (
          <img src={heroImageUrl} alt={heroAlt} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          fallback && <div className="absolute inset-0">{fallback}</div>
        )}
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-4">
          <div className={cn('w-full', cardClassName)}>{children}</div>
        </div>
      </div>
    </PhoneMockup>
  )
}
