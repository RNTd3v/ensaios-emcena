import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Clapperboard, SlidersHorizontal, Plus, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { subscribeToCenas } from '@/services/firebase/cenas'
import {
  createTarefa,
  deleteTarefa,
  subscribeToTarefas,
  updateTarefa,
  updateTarefaStatus,
  type TarefaInput,
} from '@/services/firebase/tarefas'
import { useAuthStore } from '@/stores/authStore'
import { TAREFA_STATUS, estaAberta, exigeJustificativa, statusInfo } from '@/lib/tarefas'
import { toDateKey } from '@/lib/agenda'
import { cn } from '@/lib/utils'
import type { AppUser, Cena, Equipe, Tarefa, TarefaStatus } from '@/types'

interface Props {
  equipe: Equipe
  users: Record<string, AppUser>
  /** Admin, líder ou assistente — cria, edita e exclui tarefas. */
  podeGerenciar: boolean
}

function formatPrazo(prazo: string) {
  return new Date(`${prazo}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Tarefas da equipe, agrupadas por status (abertas primeiro; feitas e canceladas recolhidas).
 * Quem é membro muda o status tocando no chip; quem gerencia toca na tarefa pra editar tudo.
 */
export function TarefasCard({ equipe, users, podeGerenciar }: Props) {
  const currentUser = useAuthStore(s => s.user)
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null)
  const [editando, setEditando] = useState<Tarefa | 'nova' | null>(null)
  const [mudandoStatus, setMudandoStatus] = useState<Tarefa | null>(null)
  // Filtros — status começa em "abertas" (a fazer, fazendo, bloqueado).
  const [filtroStatus, setFiltroStatus] = useState<'abertas' | 'todas' | TarefaStatus>('abertas')
  const [filtroResponsavel, setFiltroResponsavel] = useState<'todos' | 'minhas' | 'ninguem' | string>('todos')
  const [filtroCena, setFiltroCena] = useState<'todas' | 'sem' | string>('todas')
  const [soAtrasadas, setSoAtrasadas] = useState(false)
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  useEffect(() => subscribeToTarefas(equipe.id, setTarefas), [equipe.id])

  const podeMudarStatus = podeGerenciar || (!!currentUser && equipe.membros.includes(currentUser.uid))
  const hoje = toDateKey(new Date())

  /** Cenas que aparecem nas tarefas (pelo nome copiado na tarefa), pro filtro de cena. */
  const cenasDasTarefas = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tarefas ?? []) if (t.cenaId) m.set(t.cenaId, t.cenaNome ?? 'Cena')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [tarefas])

  const filtradas = useMemo(
    () =>
      (tarefas ?? []).filter(t => {
        if (filtroStatus === 'abertas' && !estaAberta(t.status)) return false
        if (filtroStatus !== 'abertas' && filtroStatus !== 'todas' && t.status !== filtroStatus) return false
        if (filtroResponsavel === 'minhas' && t.responsavelUid !== currentUser?.uid) return false
        if (filtroResponsavel === 'ninguem' && t.responsavelUid) return false
        if (!['todos', 'minhas', 'ninguem'].includes(filtroResponsavel) && t.responsavelUid !== filtroResponsavel) return false
        if (filtroCena === 'sem' && t.cenaId) return false
        if (filtroCena !== 'todas' && filtroCena !== 'sem' && t.cenaId !== filtroCena) return false
        if (soAtrasadas && !(t.prazo && t.prazo < hoje && estaAberta(t.status))) return false
        return true
      }),
    [tarefas, filtroStatus, filtroResponsavel, filtroCena, soAtrasadas, currentUser?.uid, hoje],
  )

  const filtrosAtivos =
    filtroStatus !== 'abertas' || filtroResponsavel !== 'todos' || filtroCena !== 'todas' || soAtrasadas
  const resumoFiltros = [
    filtroStatus === 'todas' ? 'Todos os status' : filtroStatus === 'abertas' ? null : statusInfo(filtroStatus).label,
    filtroResponsavel === 'minhas'
      ? 'Minhas'
      : filtroResponsavel === 'ninguem'
        ? 'Sem responsável'
        : filtroResponsavel !== 'todos'
          ? (users[filtroResponsavel]?.displayName?.split(' ')[0] ?? 'Pessoa')
          : null,
    filtroCena === 'sem' ? 'Sem cena' : filtroCena !== 'todas' ? (cenasDasTarefas.find(([id]) => id === filtroCena)?.[1] ?? 'Cena') : null,
    soAtrasadas ? 'Atrasadas' : null,
  ].filter((x): x is string => !!x)

  function limparFiltros() {
    setFiltroStatus('abertas')
    setFiltroResponsavel('todos')
    setFiltroCena('todas')
    setSoAtrasadas(false)
  }

  const porStatus = useMemo(() => {
    const ordenadas = [...filtradas].sort(
      (a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.createdAt.localeCompare(b.createdAt),
    )
    return Object.fromEntries(TAREFA_STATUS.map(s => [s.value, ordenadas.filter(t => t.status === s.value)])) as Record<
      TarefaStatus,
      Tarefa[]
    >
  }, [filtradas])

  const abertas = (tarefas ?? []).filter(t => estaAberta(t.status)).length
  const atrasadas = (tarefas ?? []).filter(t => t.prazo && t.prazo < hoje && estaAberta(t.status)).length

  function abrir(t: Tarefa) {
    if (podeGerenciar) setEditando(t)
    else if (podeMudarStatus) setMudandoStatus(t)
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Tarefas {tarefas && <span className="font-normal text-muted-foreground">· {abertas} abertas</span>}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {!!tarefas?.length && (
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                onClick={() => setFiltrosOpen(true)}
                title="Filtros"
                aria-label="Filtros"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {filtrosAtivos && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />}
              </Button>
            )}
            {podeGerenciar && (
              <Button size="sm" className="gap-1" onClick={() => setEditando('nova')}>
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            )}
          </div>
        </div>

        {!tarefas ? (
          <Spinner size="sm" />
        ) : tarefas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa ainda.</p>
        ) : (
          <div className="space-y-3">
            {filtrosAtivos && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
                <span className="min-w-0 truncate">
                  Filtrando: {resumoFiltros.join(' · ')} ({filtradas.length})
                </span>
                <button type="button" onClick={limparFiltros} className="shrink-0 font-medium hover:underline">
                  Limpar
                </button>
              </div>
            )}

            {filtradas.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {filtroStatus === 'abertas' && !filtrosAtivos ? 'Nenhuma tarefa aberta.' : 'Nenhuma tarefa com esses filtros.'}
              </p>
            )}

            {TAREFA_STATUS.map(s =>
              porStatus[s.value].length ? (
                <div key={s.value} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.label} ({porStatus[s.value].length})
                  </p>
                  {porStatus[s.value].map(t => (
                    <TarefaRow
                      key={t.id}
                      tarefa={t}
                      users={users}
                      hoje={hoje}
                      onAbrir={() => abrir(t)}
                      onStatus={podeMudarStatus ? () => setMudandoStatus(t) : undefined}
                    />
                  ))}
                </div>
              ) : null,
            )}
          </div>
        )}
      </CardContent>

      {editando && currentUser && (
        <TarefaDialog
          tarefa={editando === 'nova' ? undefined : editando}
          equipe={equipe}
          users={users}
          byUid={currentUser.uid}
          onClose={() => setEditando(null)}
        />
      )}
      <Dialog open={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtrar tarefas">
        <div className="space-y-4">
          <div>
            <Label htmlFor="filtro-tarefa-status">Status</Label>
            <Select id="filtro-tarefa-status" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}>
              <option value="abertas">Abertas (a fazer, fazendo, bloqueado)</option>
              <option value="todas">Todos os status</option>
              {TAREFA_STATUS.map(st => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-tarefa-responsavel">Responsável</Label>
            <Select id="filtro-tarefa-responsavel" value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="minhas">Minhas</option>
              <option value="ninguem">Sem responsável</option>
              {[...equipe.membros]
                .sort((a, b) => (users[a]?.displayName ?? '').localeCompare(users[b]?.displayName ?? '', 'pt-BR'))
                .map(uid => (
                  <option key={uid} value={uid}>
                    {users[uid]?.displayName ?? '...'}
                  </option>
                ))}
            </Select>
          </div>
          {cenasDasTarefas.length > 0 && (
            <div>
              <Label htmlFor="filtro-tarefa-cena">Cena</Label>
              <Select id="filtro-tarefa-cena" value={filtroCena} onChange={e => setFiltroCena(e.target.value)}>
                <option value="todas">Todas as cenas</option>
                <option value="sem">Sem cena</option>
                {cenasDasTarefas.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
            <span className="text-sm text-gray-700">Só atrasadas{atrasadas > 0 ? ` (${atrasadas})` : ''}</span>
            <input
              type="checkbox"
              checked={soAtrasadas}
              onChange={e => setSoAtrasadas(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={limparFiltros} disabled={!filtrosAtivos}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setFiltrosOpen(false)}>
              Ver {filtradas.length} {filtradas.length === 1 ? 'tarefa' : 'tarefas'}
            </Button>
          </div>
        </div>
      </Dialog>

      {mudandoStatus && currentUser && (
        <StatusDialog tarefa={mudandoStatus} byUid={currentUser.uid} onClose={() => setMudandoStatus(null)} />
      )}
    </Card>
  )
}

function StatusChip({ status, onClick }: { status: TarefaStatus; onClick?: () => void }) {
  const { label, icon: Icon, className } = statusInfo(status)
  const chip = (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
  if (!onClick) return chip
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      title="Mudar status"
    >
      {chip}
    </button>
  )
}

interface TarefaRowProps {
  tarefa: Tarefa
  users: Record<string, AppUser>
  hoje: string
  onAbrir: () => void
  onStatus?: () => void
}

function TarefaRow({ tarefa, users, hoje, onAbrir, onStatus }: TarefaRowProps) {
  const atrasada = !!tarefa.prazo && tarefa.prazo < hoje && estaAberta(tarefa.status)
  const fechada = !estaAberta(tarefa.status)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={e => e.key === 'Enter' && onAbrir()}
      className="cursor-pointer rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 hover:bg-gray-100"
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('min-w-0 flex-1 text-sm font-medium text-gray-900', fechada && 'text-gray-500 line-through')}>
          {tarefa.titulo}
        </p>
        <StatusChip status={tarefa.status} onClick={onStatus} />
      </div>
      {tarefa.justificativa && exigeJustificativa(tarefa.status) && (
        <p className="mt-1 whitespace-pre-wrap text-xs text-amber-800">{tarefa.justificativa}</p>
      )}
      {(tarefa.responsavelUid || tarefa.prazo || tarefa.cenaNome) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {tarefa.responsavelUid && (
            <span className="flex items-center gap-1">
              <Avatar
                photoURL={users[tarefa.responsavelUid]?.photoURL}
                name={users[tarefa.responsavelUid]?.displayName}
                className="h-4 w-4 text-[8px]"
              />
              {users[tarefa.responsavelUid]?.displayName?.split(' ')[0] ?? '...'}
            </span>
          )}
          {tarefa.prazo && (
            <span className={cn('flex items-center gap-1', atrasada && 'font-medium text-red-600')}>
              <CalendarClock className="h-3 w-3" />
              {formatPrazo(tarefa.prazo)}
              {atrasada && ' · atrasada'}
            </span>
          )}
          {tarefa.cenaNome && (
            <span className="flex min-w-0 items-center gap-1">
              <Clapperboard className="h-3 w-3 shrink-0" />
              <span className="truncate">{tarefa.cenaNome}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function StatusPicker({
  status,
  onChange,
  justificativa,
  onJustificativa,
}: {
  status: TarefaStatus
  onChange: (s: TarefaStatus) => void
  justificativa: string
  onJustificativa: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TAREFA_STATUS.map(s => {
          const Icon = s.icon
          const ativo = status === s.value
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              aria-pressed={ativo}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                ativo ? s.className + ' ring-2 ring-offset-1 ring-current' : 'border-gray-300 bg-white text-gray-600',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          )
        })}
      </div>
      {exigeJustificativa(status) && (
        <div>
          <Label htmlFor="tarefa-justificativa">Justificativa (obrigatória)</Label>
          <Textarea
            id="tarefa-justificativa"
            value={justificativa}
            onChange={e => onJustificativa(e.target.value)}
            className="mt-1.5"
            placeholder={status === 'bloqueado' ? 'O que está impedindo? Ex.: aguardando o tecido chegar' : 'Por que foi cancelada?'}
          />
        </div>
      )}
    </div>
  )
}

function StatusDialog({ tarefa, byUid, onClose }: { tarefa: Tarefa; byUid: string; onClose: () => void }) {
  const [status, setStatus] = useState<TarefaStatus>(tarefa.status)
  const [justificativa, setJustificativa] = useState(tarefa.justificativa ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const faltaJustificativa = exigeJustificativa(status) && !justificativa.trim()

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateTarefaStatus(tarefa, status, justificativa, byUid)
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Status da tarefa">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold">{tarefa.titulo}</p>
          {tarefa.descricao && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{tarefa.descricao}</p>}
        </div>
        <StatusPicker status={status} onChange={setStatus} justificativa={justificativa} onJustificativa={setJustificativa} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving || faltaJustificativa}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>
      </div>
    </Dialog>
  )
}

interface TarefaDialogProps {
  tarefa?: Tarefa
  equipe: Equipe
  users: Record<string, AppUser>
  byUid: string
  onClose: () => void
}

function TarefaDialog({ tarefa, equipe, users, byUid, onClose }: TarefaDialogProps) {
  const currentUser = useAuthStore(s => s.user)
  const [cenas, setCenas] = useState<Cena[]>([])
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? '')
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? '')
  const [status, setStatus] = useState<TarefaStatus>(tarefa?.status ?? 'a_fazer')
  const [justificativa, setJustificativa] = useState(tarefa?.justificativa ?? '')
  const [responsavelUid, setResponsavelUid] = useState(tarefa?.responsavelUid ?? '')
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? '')
  const [cenaId, setCenaId] = useState(tarefa?.cenaId ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, lista => setCenas(lista.filter(c => c.ativo)))
  }, [currentUser])

  const membros = useMemo(
    () => [...equipe.membros].sort((a, b) => (users[a]?.displayName ?? '').localeCompare(users[b]?.displayName ?? '', 'pt-BR')),
    [equipe.membros, users],
  )

  const faltaJustificativa = exigeJustificativa(status) && !justificativa.trim()

  async function run(fn: () => Promise<void>) {
    setSaving(true)
    setError('')
    try {
      await fn()
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  function handleSave() {
    if (!titulo.trim()) {
      setError('Preencha o título da tarefa.')
      return
    }
    const cena = cenas.find(c => c.id === cenaId)
    const input: TarefaInput = {
      titulo,
      descricao,
      status,
      justificativa,
      responsavelUid: responsavelUid || undefined,
      prazo: prazo || undefined,
      cenaId: cenaId || undefined,
      // Mantém o nome já salvo se a cena não estiver na lista de quem edita (sem acesso a ela).
      cenaNome: cena?.nome ?? (cenaId === tarefa?.cenaId ? tarefa?.cenaNome : undefined),
    }
    run(() => (tarefa ? updateTarefa(tarefa, input, byUid) : createTarefa(equipe.id, input, byUid)))
  }

  const cenaSalvaForaDaLista = !!tarefa?.cenaId && !cenas.some(c => c.id === tarefa.cenaId)

  return (
    <Dialog open onClose={onClose} title={tarefa ? 'Editar tarefa' : 'Nova tarefa'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="tarefa-titulo">Título</Label>
          <Input
            id="tarefa-titulo"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Ex.: Costurar a capa do rei"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="tarefa-descricao">Descrição (opcional)</Label>
          <Textarea id="tarefa-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} className="mt-1.5" />
        </div>

        <div>
          <Label>Status</Label>
          <div className="mt-1.5">
            <StatusPicker status={status} onChange={setStatus} justificativa={justificativa} onJustificativa={setJustificativa} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="tarefa-responsavel">Responsável</Label>
            <Select id="tarefa-responsavel" value={responsavelUid} onChange={e => setResponsavelUid(e.target.value)}>
              <option value="">Ninguém</option>
              {membros.map(uid => (
                <option key={uid} value={uid}>
                  {users[uid]?.displayName ?? '...'}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tarefa-prazo">Prazo</Label>
            <Input id="tarefa-prazo" type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="tarefa-cena">Cena (opcional)</Label>
          <Select id="tarefa-cena" value={cenaId} onChange={e => setCenaId(e.target.value)}>
            <option value="">Nenhuma — vale pra peça toda</option>
            {cenaSalvaForaDaLista && <option value={tarefa!.cenaId}>{tarefa!.cenaNome ?? 'Cena'}</option>}
            {cenas.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full" onClick={handleSave} disabled={saving || !titulo.trim() || faltaJustificativa}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          {tarefa ? 'Salvar' : 'Criar tarefa'}
        </Button>

        {tarefa &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir essa tarefa? Se ela só não vai mais acontecer, prefira o status Cancelado.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Voltar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => run(() => deleteTarefa(tarefa))} disabled={saving}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Excluir tarefa
            </Button>
          ))}
      </div>
    </Dialog>
  )
}
