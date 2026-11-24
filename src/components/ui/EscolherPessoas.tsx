import { useMemo, useState } from 'react'
import { Check, Drama, Search, Users, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PessoaLinha } from '@/components/ui/PessoaLinha'
import { inscritosConfirmados, pessoaOpcao } from '@/components/ui/PessoaSelect'
import { cn } from '@/lib/utils'
import type { AppUser, Cena, Equipe } from '@/types'

type FiltroPessoas = 'todas' | 'lideres' | 'assistentes'

const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Escolha de pessoas uma a uma, com busca e filtros (só líderes, só assistentes, de uma cena ou
 * equipe). Admin escolhe entre todos os inscritos confirmados; líder, entre quem está nas cenas e
 * equipes que lidera (a Cloud Function confere de novo no envio).
 */
export function EscolherPessoas({
  isAdmin,
  users,
  cenas,
  equipes,
  escolhidos,
  onChange,
  excluir,
}: {
  isAdmin: boolean
  users: Record<string, AppUser>
  cenas: Cena[]
  equipes: Equipe[]
  escolhidos: string[]
  onChange: (uids: string[]) => void
  /** uids que não aparecem na lista (ex.: quem já tem personagem, no convite do ensaio geral). */
  excluir?: Set<string>
}) {
  const [filtro, setFiltro] = useState<FiltroPessoas>('todas')
  const [gruposSel, setGruposSel] = useState<string[]>([])
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [grupoAberto, setGrupoAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const lideres = useMemo(
    () => new Set([...cenas.map(c => c.liderUid), ...equipes.map(e => e.liderUid)].filter((u): u is string => !!u)),
    [cenas, equipes],
  )
  const assistentes = useMemo(
    () => new Set([...cenas.flatMap(c => c.assistentes ?? []), ...equipes.flatMap(e => e.assistentes)]),
    [cenas, equipes],
  )

  const pool = useMemo(() => {
    const doGrupos = new Set([...cenas.flatMap(c => [...c.participantes, c.liderUid ?? '']), ...equipes.flatMap(e => e.membros)])
    const base = isAdmin
      ? inscritosConfirmados(users, [...lideres, ...assistentes])
      : Object.values(users).filter(u => u.active !== false && doGrupos.has(u.uid))
    return base.filter(u => !u.dependente && !excluir?.has(u.uid)).map(u => pessoaOpcao(u.uid, u)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [isAdmin, users, cenas, equipes, lideres, assistentes, excluir])

  const opcoesGrupo = useMemo(
    () => [
      ...equipes.map(e => ({ chave: `equipe:${e.id}`, tipo: 'equipe' as const, nome: e.nome })),
      ...cenas.map(c => ({ chave: `cena:${c.id}`, tipo: 'cena' as const, nome: c.nome })),
    ],
    [cenas, equipes],
  )
  const sugestoesGrupo = useMemo(() => {
    const q = normalizar(buscaGrupo.trim())
    return opcoesGrupo.filter(o => !gruposSel.includes(o.chave) && (!q || normalizar(o.nome).includes(q)))
  }, [opcoesGrupo, gruposSel, buscaGrupo])

  const visiveis = useMemo(() => {
    // Várias cenas/equipes juntas: vale quem está em qualquer uma delas.
    const doGrupo = gruposSel.length
      ? new Set(
          gruposSel.flatMap(chave => {
            const [tipo, id] = chave.split(':')
            if (tipo === 'cena') {
              const c = cenas.find(x => x.id === id)
              return [...(c?.participantes ?? []), c?.liderUid ?? '']
            }
            return equipes.find(e => e.id === id)?.membros ?? []
          }),
        )
      : null
    const q = normalizar(busca.trim())
    return pool.filter(
      p =>
        (filtro === 'todas' || (filtro === 'lideres' ? lideres.has(p.uid) : assistentes.has(p.uid))) &&
        (!doGrupo || doGrupo.has(p.uid)) &&
        (!q || normalizar(`${p.nome} ${p.apelido ?? ''}`).includes(q)),
    )
  }, [pool, filtro, gruposSel, busca, cenas, equipes, lideres, assistentes])

  const selecionados = new Set(escolhidos)
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every(p => selecionados.has(p.uid))

  function alternar(u: string) {
    onChange(selecionados.has(u) ? escolhidos.filter(x => x !== u) : [...escolhidos, u])
  }

  function alternarVisiveis() {
    const ids = visiveis.map(p => p.uid)
    onChange(todosVisiveisMarcados ? escolhidos.filter(u => !ids.includes(u)) : [...new Set([...escolhidos, ...ids])])
  }

  const filtros: { value: FiltroPessoas; label: string }[] = [
    { value: 'todas', label: 'Todas' },
    { value: 'lideres', label: 'Só líderes' },
    { value: 'assistentes', label: 'Só assistentes' },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Pessoas</Label>
        <span className="text-xs font-medium text-primary">
          {escolhidos.length} {escolhidos.length === 1 ? 'escolhida' : 'escolhidas'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filtros.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              filtro === f.value ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(cenas.length > 0 || equipes.length > 0) && (
        <div className="space-y-1.5">
          {gruposSel.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {gruposSel.map(chave => {
                const opcao = opcoesGrupo.find(o => o.chave === chave)
                if (!opcao) return null
                return (
                  <span key={chave} className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-primary">
                    {opcao.tipo === 'cena' ? <Drama className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                    {opcao.nome}
                    <button type="button" aria-label={`Tirar ${opcao.nome}`} onClick={() => setGruposSel(l => l.filter(x => x !== chave))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <div className="relative">
            <Input
              value={buscaGrupo}
              onChange={e => {
                setBuscaGrupo(e.target.value)
                setGrupoAberto(true)
              }}
              onFocus={() => setGrupoAberto(true)}
              onBlur={() => setTimeout(() => setGrupoAberto(false), 150)}
              placeholder="Filtrar por cena ou equipe (digite pra buscar)"
              aria-label="Filtrar por cena ou equipe"
              autoComplete="off"
            />
            {grupoAberto && sugestoesGrupo.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                {sugestoesGrupo.map(o => (
                  <li key={o.chave}>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setGruposSel(l => [...l, o.chave])
                        setBuscaGrupo('')
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {o.tipo === 'cena' ? <Drama className="h-4 w-4 text-gray-400" /> : <Users className="h-4 w-4 text-gray-400" />}
                      <span className="flex-1 truncate">{o.nome}</span>
                      <span className="text-[11px] text-gray-400">{o.tipo === 'cena' ? 'Cena' : 'Equipe'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou apelido" className="pl-9" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <button
          type="button"
          onClick={alternarVisiveis}
          disabled={!visiveis.length}
          className="flex w-full items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
        >
          {todosVisiveisMarcados ? 'Desmarcar' : 'Marcar'} {visiveis.length} da lista
          <Checkbox marcado={todosVisiveisMarcados} />
        </button>
        <div className="max-h-64 overflow-y-auto px-2">
          {visiveis.map(p => (
            <PessoaLinha
              key={p.uid}
              pessoa={p}
              funcao={lideres.has(p.uid) ? 'lider' : assistentes.has(p.uid) ? 'assistente' : undefined}
              onClick={() => alternar(p.uid)}
              className="border-b border-gray-100 py-1.5 last:border-b-0"
            >
              <button type="button" onClick={() => alternar(p.uid)} aria-label={selecionados.has(p.uid) ? 'Desmarcar' : 'Marcar'}>
                <Checkbox marcado={selecionados.has(p.uid)} />
              </button>
            </PessoaLinha>
          ))}
          {visiveis.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ninguém nesse filtro.</p>}
        </div>
      </div>
    </div>
  )
}

function Checkbox({ marcado }: { marcado: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
        marcado ? 'border-primary bg-primary text-white' : 'border-gray-300',
      )}
    >
      {marcado && <Check className="h-3.5 w-3.5" />}
    </span>
  )
}
