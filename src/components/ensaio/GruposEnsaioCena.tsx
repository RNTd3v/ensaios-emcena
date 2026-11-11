import { Plus, Trash2 } from 'lucide-react'
import { PersonagensMultiSelect } from '@/components/ensaio/PersonagensMultiSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { AppUser, GrupoEnsaioCena, LocalEnsaio, Personagem } from '@/types'

interface Props {
  grupos: GrupoEnsaioCena[]
  onChange: (grupos: GrupoEnsaioCena[]) => void
  /** Personagens chamados pro ensaio (quem pode entrar num grupo). */
  personagens: Personagem[]
  /** Pra mostrar a foto de quem faz cada personagem. */
  users: Record<string, AppUser>
  locais?: LocalEnsaio[]
  compacto?: boolean
}

const chip = (ativo: boolean) =>
  cn(
    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
    ativo ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
  )

/**
 * Divide o ensaio em grupos com horário e local próprios (ex.: "X, Y e Z às 14h atrás do templo;
 * A, B e C às 14h no templo; D, E e F às 15h no templo"). Os grupos são de personagens — quem faz
 * o personagem (e os pais, no caso de criança) recebe o horário do grupo. Personagem fora de grupo
 * segue o horário e o local do ensaio.
 */
export function GruposEnsaioCena({ grupos, onChange, personagens, users, locais = [], compacto }: Props) {
  const alocado = (id: string) => grupos.find(g => g.personagens.includes(id))
  const semGrupo = personagens.filter(p => !alocado(p.id)).length

  function atualizar(id: string, parcial: Partial<GrupoEnsaioCena>) {
    onChange(grupos.map(g => (g.id === id ? { ...g, ...parcial } : g)))
  }

  /** Marca/desmarca o personagem no grupo (tirando de qualquer outro). */
  function alternar(grupoId: string, personagemId: string) {
    onChange(
      grupos.map(g =>
        g.id === grupoId
          ? { ...g, personagens: g.personagens.includes(personagemId) ? g.personagens.filter(x => x !== personagemId) : [...g.personagens, personagemId] }
          : { ...g, personagens: g.personagens.filter(x => x !== personagemId) },
      ),
    )
  }

  function novoGrupo(horarioBase: string) {
    onChange([...grupos, { id: crypto.randomUUID(), nome: '', horario: grupos.at(-1)?.horario ?? horarioBase, local: '', personagens: [] }])
  }

  if (!personagens.length) return null

  return (
    <div className="space-y-2">
      <div>
        <p className={cn('font-medium', compacto ? 'text-xs text-muted-foreground' : 'text-sm')}>Grupos (opcional)</p>
        {!compacto && (
          <p className="text-xs text-muted-foreground">
            Separe os personagens em grupos, cada um com seu horário e local. Quem ficar sem grupo segue o horário e o local do ensaio
            {grupos.length > 0 && ` (${semGrupo} sem grupo)`}.
          </p>
        )}
      </div>

      {grupos.map((g, i) => (
        <div key={g.id} className="space-y-2 rounded-xl border border-gray-200 p-2.5">
          <div className="flex items-center gap-2">
            <Input value={g.nome ?? ''} onChange={e => atualizar(g.id, { nome: e.target.value })} placeholder={`Grupo ${i + 1} (nome opcional)`} className="h-8 text-sm" />
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
            <Input type="time" value={g.horario} onChange={e => atualizar(g.id, { horario: e.target.value })} className="h-8 flex-[2] text-sm" aria-label="Horário do grupo" />
            <Input value={g.local ?? ''} onChange={e => atualizar(g.id, { local: e.target.value })} placeholder="Local do grupo" className="h-8 flex-[3] text-sm" />
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
          <PersonagensMultiSelect
            personagens={personagens}
            users={users}
            selecionados={g.personagens}
            onChange={ids => atualizar(g.id, { personagens: ids })}
            onToggle={id => alternar(g.id, id)}
            vazio="Escolher personagens"
            detalhe={p => {
              const outro = alocado(p.id)
              return outro && outro.id !== g.id ? `hoje em ${outro.nome || 'outro grupo'}` : undefined
            }}
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={() => novoGrupo('')}>
        <Plus className="h-4 w-4" />
        Novo grupo
      </Button>
    </div>
  )
}
