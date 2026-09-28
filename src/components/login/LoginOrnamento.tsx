import type { ReactNode } from 'react'

/** Rótulo em caixa-alta entre dois filetes com losango — ecoa o ornamento do logo do musical. */
export function LoginOrnamento({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2.5 text-white/70">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/40" />
      <span className="h-1 w-1 rotate-45 bg-white/60" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">{children}</span>
      <span className="h-1 w-1 rotate-45 bg-white/60" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/40" />
    </div>
  )
}
