import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Selo do `avisoNaoChamado`: "Você não precisa ir" ou, se um dependente foi chamado, "Só Fulano precisa ir". */
export function AvisoNaoChamado({ soPrecisam }: { soPrecisam: string[] }) {
  const texto = soPrecisam.length
    ? `Só ${new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(soPrecisam)} ${soPrecisam.length > 1 ? 'precisam' : 'precisa'} ir`
    : 'Você não precisa ir'
  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        soPrecisam.length ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-orange-700',
      )}
    >
      <Info className="h-3 w-3 shrink-0" />
      <span className="truncate">{texto}</span>
    </span>
  )
}
