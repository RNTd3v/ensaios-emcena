import { Backpack, Shirt } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface Preparo {
  /** O que vestir (texto livre). */
  roupa: string
  /** O que levar (texto livre). */
  levar: string
}

/** Campos "O que vestir" / "O que levar" ao confirmar ou editar um ensaio. `compacto` = no modal da semana. */
export function PreparoCampos({
  value,
  onChange,
  compacto,
  idPrefixo,
}: {
  value: Preparo
  onChange: (patch: Partial<Preparo>) => void
  compacto?: boolean
  idPrefixo: string
}) {
  if (compacto) {
    return (
      <div className="space-y-1.5">
        <Input
          value={value.roupa}
          onChange={e => onChange({ roupa: e.target.value })}
          placeholder="O que vestir (opcional)"
          aria-label="O que vestir"
          className="h-8 text-sm"
        />
        <Input
          value={value.levar}
          onChange={e => onChange({ levar: e.target.value })}
          placeholder="O que levar (opcional)"
          aria-label="O que levar"
          className="h-8 text-sm"
        />
      </div>
    )
  }
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefixo}-roupa`}>O que vestir</Label>
        <Input id={`${idPrefixo}-roupa`} value={value.roupa} onChange={e => onChange({ roupa: e.target.value })} placeholder="Ex.: Roupa preta e tênis" />
      </div>
      <div>
        <Label htmlFor={`${idPrefixo}-levar`}>O que levar</Label>
        <Input id={`${idPrefixo}-levar`} value={value.levar} onChange={e => onChange({ levar: e.target.value })} placeholder="Ex.: Roteiro e garrafa d'água" />
      </div>
    </>
  )
}

/** Linhas "vestir" / "levar" de um ensaio (página do ensaio e card da Home). Nada se os dois estão vazios. */
export function PreparoInfo({ roupa, levar, className }: { roupa?: string; levar?: string; className?: string }) {
  if (!roupa && !levar) return null
  return (
    <div className={cn('space-y-1', className)}>
      {roupa && (
        <p className="flex items-start gap-1.5 text-sm text-gray-700">
          <Shirt className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Vestir:</span> {roupa}
          </span>
        </p>
      )}
      {levar && (
        <p className="flex items-start gap-1.5 text-sm text-gray-700">
          <Backpack className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Levar:</span> {levar}
          </span>
        </p>
      )}
    </div>
  )
}
