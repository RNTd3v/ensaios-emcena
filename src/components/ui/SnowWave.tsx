import { cn } from '@/lib/utils'

/** Onda de "neve" decorativa, tipo monte de neve na base de um card de destaque. */
export function SnowWave({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 60"
      preserveAspectRatio="none"
      className={cn('absolute bottom-0 left-0 w-full h-12 text-white/10 pointer-events-none', className)}
      aria-hidden="true"
    >
      <path
        d="M0,38 C40,12 80,55 120,32 C160,10 200,50 240,28 C280,6 320,48 360,26 C380,16 390,30 400,24 L400,60 L0,60 Z"
        fill="currentColor"
      />
    </svg>
  )
}
