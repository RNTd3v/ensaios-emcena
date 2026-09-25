import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Moldura de iPhone usada em telas grandes: no celular renderiza `children` em tela cheia,
 * normalmente. A partir do breakpoint `sm`, o MESMO conteúdo (uma única árvore, sem duplicar —
 * importante pra páginas com listeners/efeitos, tipo listas em tempo real) fica contido numa
 * moldura de smartphone centralizada, com notch e cantos arredondados.
 */
export function PhoneMockup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="sm:flex sm:min-h-screen sm:items-center sm:justify-center sm:overflow-hidden sm:bg-gradient-to-br sm:from-primary/15 sm:via-[hsl(297_44%_85%)] sm:to-[#52467f] sm:dark:via-[#7b467f] sm:dark:to-[hsl(270_14%_22%)] sm:px-8">
      <div
        className={cn(
          'relative flex h-screen flex-col overflow-hidden bg-background',
          'sm:h-[min(880px,calc(100svh-2rem))] sm:w-[420px] sm:shrink-0 sm:overflow-hidden sm:rounded-[3rem] sm:border-[12px] sm:border-neutral-900 sm:shadow-2xl',
          className,
        )}
      >
        <div className="hidden sm:block sm:absolute sm:left-1/2 sm:top-0 sm:z-30 sm:h-6 sm:w-28 sm:-translate-x-1/2 sm:translate-y-1.5 sm:rounded-full sm:bg-neutral-900" />
        {children}
      </div>
    </div>
  )
}
