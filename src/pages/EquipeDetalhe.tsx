import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Crown, HandHelping, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { EquipeFormDialog } from '@/components/equipe/EquipeFormDialog'
import { TarefasCard } from '@/components/equipe/TarefasCard'
import { PrazoFigurinoCard } from '@/components/equipe/PrazoFigurinoCard'
import { MusicasCard } from '@/components/midia/MusicasCard'
import { FigurinosCard } from '@/components/midia/FigurinosCard'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { deleteEquipe, subscribeToEquipe, updateEquipePessoas } from '@/services/firebase/equipes'
import { useAuthStore } from '@/stores/authStore'
import { equipeIcon } from '@/lib/equipeIcons'
import { cn } from '@/lib/utils'
import type { Equipe } from '@/types'

/**
 * Detalhe de uma equipe: tarefas, líder, assistentes e membros. Admin e o líder da equipe
 * adicionam/removem pessoas e marcam assistentes; nome, ícone e líder só o admin troca (pelo lápis).
 * Tarefas: admin, líder e assistentes cadastram; membros atualizam o status.
 */
export function EquipeDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useAuthStore(s => s.user)
  const users = useUsersMap()
  const [equipe, setEquipe] = useState<Equipe | null | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)
  const [novoMembro, setNovoMembro] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    return subscribeToEquipe(id, setEquipe)
  }, [id])

  const isAdmin = currentUser?.role === 'admin'
  const isLider = !!equipe && !!currentUser && equipe.liderUid === currentUser.uid
  const podeGerenciar = isAdmin || isLider
  /** Tarefas: além de admin e líder, os assistentes também criam e editam. */
  const podeGerenciarTarefas = podeGerenciar || (!!equipe && !!currentUser && equipe.assistentes.includes(currentUser.uid))
  /** Músicas/figurinos que a equipe gerencia: qualquer membro (e admin) cadastra e edita, aqui. */
  const podeGerenciarMidia = isAdmin || (!!equipe && !!currentUser && equipe.membros.includes(currentUser.uid))

  const nameFor = (uid: string) => users[uid]?.displayName ?? 'Sem nome'

  const outros = useMemo(
    () =>
      (equipe?.membros ?? [])
        .filter(uid => uid !== equipe?.liderUid)
        .sort((a, b) => {
          const aa = Number(!equipe?.assistentes.includes(a))
          const bb = Number(!equipe?.assistentes.includes(b))
          return aa - bb || nameFor(a).localeCompare(nameFor(b), 'pt-BR')
        }),
    [equipe, users],
  )

  const disponiveis = useMemo(
    () =>
      Object.values(users)
        .filter(u => u.active !== false && !equipe?.membros.includes(u.uid))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')),
    [users, equipe?.membros],
  )

  function handleVoltar() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/equipes')
  }

  async function salvarPessoas(membros: string[], assistentes: string[]) {
    if (!equipe) return
    setSaving(true)
    try {
      await updateEquipePessoas(equipe.id, membros, assistentes)
    } finally {
      setSaving(false)
    }
  }

  if (equipe === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  if (!equipe) {
    return (
      <div className="space-y-4">
        <p className="text-white">Equipe não encontrada.</p>
        <Button variant="outline" onClick={() => navigate('/equipes')}>
          Voltar
        </Button>
      </div>
    )
  }

  const Icon = equipeIcon(equipe.icone)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleVoltar} title="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-white">{equipe.nome}</h1>
        {podeGerenciar && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:bg-white/10" onClick={() => setEditOpen(true)} title="Editar equipe">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {equipe.descricao && (
        <Card>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{equipe.descricao}</p>
          </CardContent>
        </Card>
      )}

      <TarefasCard equipe={equipe} users={users} podeGerenciar={podeGerenciarTarefas} />

      {equipe.gerencia?.includes('figurinos') && (
        <>
          <PrazoFigurinoCard key={equipe.prazoFigurino ?? ''} equipe={equipe} podeEditar={podeGerenciarTarefas} />
          <FigurinosCard gerenciar={podeGerenciarMidia ? { equipeId: equipe.id } : undefined} />
        </>
      )}

      {equipe.gerencia?.includes('musicas') && (
        <MusicasCard gerenciar={podeGerenciarMidia ? { equipeId: equipe.id } : undefined} />
      )}

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-semibold">Pessoas ({equipe.membros.length})</p>

          {equipe.liderUid ? (
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <Avatar photoURL={users[equipe.liderUid]?.photoURL} name={nameFor(equipe.liderUid)} className="h-9 w-9 text-xs" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
                  <Crown className="h-2.5 w-2.5 text-white" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nameFor(equipe.liderUid)}</p>
                <p className="text-xs text-amber-600">Líder</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem líder definido{isAdmin ? ' — escolha pelo lápis.' : '.'}
            </p>
          )}

          {outros.length > 0 && (
            <div className="space-y-1 border-t border-gray-100 pt-2">
              {outros.map(uid => {
                const assistente = equipe.assistentes.includes(uid)
                return (
                  <div key={uid} className="flex items-center gap-2.5 py-1">
                    <div className="relative shrink-0">
                      <Avatar photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-9 w-9 text-xs" />
                      {assistente && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-2 ring-white">
                          <HandHelping className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nameFor(uid)}</p>
                      {assistente && <p className="text-xs text-primary">Assistente</p>}
                    </div>
                    {podeGerenciar && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={saving}
                          onClick={() =>
                            salvarPessoas(
                              equipe.membros,
                              assistente ? equipe.assistentes.filter(a => a !== uid) : [...equipe.assistentes, uid],
                            )
                          }
                          className={cn('h-9 w-9 shrink-0', assistente ? 'text-primary' : 'text-gray-300')}
                          title={assistente ? 'Deixar de ser assistente' : 'Tornar assistente'}
                          aria-pressed={assistente}
                        >
                          <HandHelping className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={saving}
                          onClick={() =>
                            salvarPessoas(
                              equipe.membros.filter(m => m !== uid),
                              equipe.assistentes.filter(a => a !== uid),
                            )
                          }
                          className="h-9 w-9 shrink-0 bg-red-50 text-red-600 hover:bg-red-100"
                          title="Tirar da equipe"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {podeGerenciar && (
            <div className="flex items-center gap-1.5 border-t border-gray-100 pt-3">
              <div className="flex-1">
                <Select value={novoMembro} onChange={e => setNovoMembro(e.target.value)}>
                  <option value="">Adicionar pessoa...</option>
                  {disponiveis.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                size="icon"
                title="Adicionar"
                disabled={!novoMembro || saving}
                onClick={async () => {
                  await salvarPessoas([...equipe.membros, novoMembro], equipe.assistentes)
                  setNovoMembro('')
                }}
                className="shrink-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin &&
        (confirmDelete ? (
          <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">Excluir a equipe "{equipe.nome}"? As pessoas não são afetadas, só deixam de fazer parte dela.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 bg-white" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  await deleteEquipe(equipe.id)
                  navigate('/equipes', { replace: true })
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full gap-1.5 border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Excluir equipe
          </Button>
        ))}

      {editOpen && <EquipeFormDialog equipe={equipe} isAdmin={isAdmin} users={users} onClose={() => setEditOpen(false)} />}
    </div>
  )
}
