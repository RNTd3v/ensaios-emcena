import { useMemo, useState } from 'react'
import { Check, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PessoaLinha } from '@/components/ui/PessoaLinha'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { cn } from '@/lib/utils'
import type { AppUser, GrupoEnsaio, LocalEnsaio } from '@/types'

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  grupos: GrupoEnsaio[]
  onChange: (grupos: GrupoEnsaio[]) => void
  /** Quem pode entrar num grupo: o elenco e os convidados. */
  pool: string[]
  users: Record<string, AppUser>
  locais: LocalEnsaio[]
}

/**
 * Divide o ensaio geral em grupos: cada grupo tem seu horário e local (ex.: "X, Y e Z às 14h atrás
 * do templo; A, B e C às 14h no templo"). A pessoa só fica em um grupo; quem não entra em nenhum
 * segue o horário e o local gerais do ensaio.
 */
export function GruposEnsaioEditor({ grupos, onChange, pool, users, locais }: Props) {
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const alocados = useMemo(() => new Set(grupos.flatMap(g => g.pessoas)), [grupos])
  const semGrupo = pool.filter(u => !alocados.has(u)).length

  function atualizar(id: string, parcial: Partial<GrupoEnsaio>) {
    onChange(grupos.map(g => (g.id === id ? { ...g, ...parcial } : g)))
  }

  function novoGrupo() {
    const id = crypto.randomUUID()
    onChange([...grupos, { id, nome: '', horario: grupos.at(-1)?.horario ?? '', local: '', pessoas: [] }])
    setAbertoId(id)
    setBusca('')
  }

  const chip = (ativo: boolean) =>
    cn(
      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
      ativo ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
    )

  return (
    <div className="space-y-3">
      <div>
        <Label>Grupos (opcional)</Label>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Separe o elenco em grupos com horário e local próprios. Quem ficar sem grupo segue o horário e o local acima
          {grupos.length > 0 && ` (${semGrupo} ${semGrupo === 1 ? 'pessoa' : 'pessoas'} sem grupo)`}.
        </p>
      </div>

      {grupos.map((g, i) => {
        const aberto = abertoId === g.id
        const q = normalizar(busca.trim())
        const disponiveis = pool
          .filter(u => !alocados.has(u))
          .map(u => pessoaOpcao(u, users[u]))
          .filter(p => !q || normalizar(`${p.nome} ${p.apelido ?? ''}`).includes(q))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        return (
          <div key={g.id} className="space-y-2 rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <Input value={g.nome ?? ''} onChange={e => atualizar(g.id, { nome: e.target.value })} placeholder={`Grupo ${i + 1} (nome opcional)`} />
              <button
                type="button"
                title="Remover grupo"
                onClick={() => onChange(grupos.filter(x => x.id !== g.id))}
                className="shrink-0 p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <Input type="time" value={g.horario} onChange={e => atualizar(g.id, { horario: e.target.value })} className="flex-[2]" aria-label="Horário do grupo" />
              <Input value={g.local ?? ''} onChange={e => atualizar(g.id, { local: e.target.value })} placeholder="Local do grupo" className="flex-[3]" />
            </div>
            {locais.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {locais.map(l => {
                  const sel = (g.local ?? '').trim().toLowerCase() === l.nome.trim().toLowerCase()
                  return (
                    <button key={l.id} type="button" onClick={() => atualizar(g.id, { local: sel ? '' : l.nome })} className={chip(sel)}>
                      {l.nome}
                    </button>
                  )
                })}
              </div>
            )}

            <p className="text-xs font-medium text-gray-600">
              {g.pessoas.length} {g.pessoas.length === 1 ? 'pessoa' : 'pessoas'}
            </p>
            {g.pessoas.length > 0 && (
              <div className="space-y-1">
                {g.pessoas.map(u => (
                  <PessoaLinha key={u} pessoa={pessoaOpcao(u, users[u])}>
                    <button
                      type="button"
                      title="Tirar do grupo"
                      onClick={() => atualizar(g.id, { pessoas: g.pessoas.filter(x => x !== u) })}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </PessoaLinha>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => {
                setAbertoId(aberto ? null : g.id)
                setBusca('')
              }}
            >
              <Plus className="h-4 w-4" />
              {aberto ? 'Fechar lista' : 'Adicionar pessoas'}
            </Button>

            {aberto && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa" className="pl-9" />
                </div>
                {disponiveis.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Ninguém sobrando pra adicionar.</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => atualizar(g.id, { pessoas: [...g.pessoas, ...disponiveis.map(p => p.uid)] })}
                      className="text-xs font-medium text-primary"
                    >
                      Adicionar todos da lista ({disponiveis.length})
                    </button>
                    <div className="max-h-56 space-y-0.5 overflow-y-auto">
                      {disponiveis.map(p => (
                        <PessoaLinha key={p.uid} pessoa={p} onClick={() => atualizar(g.id, { pessoas: [...g.pessoas, p.uid] })} className="rounded-lg hover:bg-gray-50">
                          <Check className="h-4 w-4 text-gray-300" />
                        </PessoaLinha>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={novoGrupo}>
        <Plus className="h-4 w-4" />
        Novo grupo
      </Button>
    </div>
  )
}
