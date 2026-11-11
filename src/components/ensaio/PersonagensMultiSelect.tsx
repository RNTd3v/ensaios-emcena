import { useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { cn } from '@/lib/utils'
import type { AppUser, Personagem } from '@/types'

interface Props {
  personagens: Personagem[]
  users: Record<string, AppUser>
  /** ids dos personagens marcados. */
  selecionados: string[]
  onChange: (ids: string[]) => void
  /** Texto do campo quando nada está marcado. */
  vazio: string
  /** Mostra "Todos" no topo da lista (marca/desmarca todos). */
  comTodos?: boolean
  /** Segunda linha extra de um personagem (ex.: "hoje em Grupo 1"). */
  detalhe?: (p: Personagem) => string | undefined
  /** Se o clique em `p` alterna só ele ou delega (ex.: tirar de outro grupo) — padrão: alterna. */
  onToggle?: (id: string) => void
}

/**
 * Seleção múltipla de personagens: campo que abre uma lista em ordem alfabética (A–Z), cada linha
 * com a foto de quem faz o personagem, o nome do personagem e o da pessoa.
 */
export function PersonagensMultiSelect({ personagens, users, selecionados, onChange, vazio, comTodos, detalhe, onToggle }: Props) {
  const [aberto, setAberto] = useState(false)
  const ordenados = useMemo(() => [...personagens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [personagens])
  const marcados = ordenados.filter(p => selecionados.includes(p.id))
  const todos = ordenados.length > 0 && marcados.length === ordenados.length

  function alternar(id: string) {
    if (onToggle) return onToggle(id)
    onChange(selecionados.includes(id) ? selecionados.filter(x => x !== id) : [...selecionados, id])
  }

  const caixa = (marcado: boolean) => (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
        marcado ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white',
      )}
    >
      {marcado && <Check className="h-3.5 w-3.5" />}
    </span>
  )

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm"
      >
        <span className="min-w-0 truncate">
          {marcados.length
            ? todos && comTodos
              ? 'Todos os personagens'
              : `${marcados.length} ${marcados.length === 1 ? 'personagem' : 'personagens'}: ${marcados.map(p => p.nome).join(', ')}`
            : vazio}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-gray-200 p-1">
          {comTodos && (
            <button
              type="button"
              onClick={() => onChange(todos ? [] : ordenados.map(p => p.id))}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-gray-50"
            >
              <span className="flex-1">Todos</span>
              {caixa(todos)}
            </button>
          )}
          {ordenados.map(p => {
            const marcado = selecionados.includes(p.id)
            const ator = p.participanteUid ? pessoaOpcao(p.participanteUid, users[p.participanteUid]) : undefined
            const extra = detalhe?.(p)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => alternar(p.id)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50', marcado && 'bg-primary/5')}
              >
                <Avatar photoURL={ator?.photoURL} name={ator?.nome ?? p.nome} className="h-9 w-9 shrink-0 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {ator ? ator.apelido || ator.nome : 'Sem pessoa'}
                    {extra && ` · ${extra}`}
                  </span>
                </span>
                {caixa(marcado)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
