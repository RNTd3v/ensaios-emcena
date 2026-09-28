import type { ReactNode } from 'react'
import { Crown, HandHelping } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import type { PessoaOpcao } from '@/components/ui/PessoaSelect'
import { cn } from '@/lib/utils'

const FUNCOES = {
  lider: { Icone: Crown, selo: 'bg-amber-400', texto: 'text-amber-600', rotulo: 'Líder' },
  assistente: { Icone: HandHelping, selo: 'bg-primary', texto: 'text-primary', rotulo: 'Assistente' },
} as const

interface Props {
  pessoa: PessoaOpcao
  /** Selo na foto + rótulo ao lado do apelido. */
  funcao?: keyof typeof FUNCOES
  /** Texto extra na segunda linha (ex.: "Responsável"). */
  detalhe?: ReactNode
  /** Ações à direita (botões). */
  children?: ReactNode
  onClick?: () => void
  className?: string
}

/**
 * Jeito padrão de mostrar uma pessoa escolhida (membro de cena, equipe, oração...): foto, nome e,
 * embaixo, apelido e função.
 */
export function PessoaLinha({ pessoa, funcao, detalhe, children, onClick, className }: Props) {
  const f = funcao ? FUNCOES[funcao] : undefined
  const segundaLinha = [
    pessoa.apelido && <span key="apelido" className="text-muted-foreground">{pessoa.apelido}</span>,
    f && <span key="funcao" className={f.texto}>{f.rotulo}</span>,
    detalhe && <span key="detalhe" className="text-muted-foreground">{detalhe}</span>,
  ].filter(Boolean)

  const conteudo = (
    <>
      <div className="relative shrink-0">
        <Avatar photoURL={pessoa.photoURL} name={pessoa.nome} className="h-9 w-9 text-xs" />
        {f && (
          <span className={cn('absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white', f.selo)}>
            <f.Icone className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{pessoa.nome}</p>
        {segundaLinha.length > 0 && (
          <p className="truncate text-xs">
            {segundaLinha.map((item, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted-foreground"> · </span>}
                {item}
              </span>
            ))}
          </p>
        )}
      </div>
    </>
  )

  return (
    <div className={cn('flex items-center gap-2.5 py-1', className)}>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2.5">
          {conteudo}
        </button>
      ) : (
        conteudo
      )}
      {children}
    </div>
  )
}
