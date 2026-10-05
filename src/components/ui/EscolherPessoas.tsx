import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
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
}: {
  isAdmin: boolean
  users: Record<string, AppUser>
  cenas: Cena[]
  equipes: Equipe[]
  escolhidos: string[]
  onChange: (uids: string[]) => void
}) {
  const [filtro, setFiltro] = useState<FiltroPessoas>('todas')
  const [grupo, setGrupo] = useState('')
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
    return base.filter(u => !u.dependente).map(u => pessoaOpcao(u.uid, u)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [isAdmin, users, cenas, equipes, lideres, assistentes])

  const visiveis = useMemo(() => {
    const [tipo, id] = grupo.split(':')
    const doGrupo =
      tipo === 'cena'
        ? new Set([...(cenas.find(c => c.id === id)?.participantes ?? []), cenas.find(c => c.id === id)?.liderUid ?? ''])
        : tipo === 'equipe'
          ? new Set(equipes.find(e => e.id === id)?.membros ?? [])
          : null
    const q = normalizar(busca.trim())
    return pool.filter(
      p =>
        (filtro === 'todas' || (filtro === 'lideres' ? lideres.has(p.uid) : assistentes.has(p.uid))) &&
        (!doGrupo || doGrupo.has(p.uid)) &&
        (!q || normalizar(`${p.nome} ${p.apelido ?? ''}`).includes(q)),
    )
  }, [pool, filtro, grupo, busca, cenas, equipes, lideres, assistentes])

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
        <Select value={grupo} onChange={e => setGrupo(e.target.value)} aria-label="Filtrar por cena ou equipe">
          <option value="">De qualquer cena ou equipe</option>
          {cenas.length > 0 && (
            <optgroup label="Cenas">
              {cenas.map(c => (
                <option key={c.id} value={`cena:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          )}
          {equipes.length > 0 && (
            <optgroup label="Equipes">
              {equipes.map(e => (
                <option key={e.id} value={`equipe:${e.id}`}>
                  {e.nome}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
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
