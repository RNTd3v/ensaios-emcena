import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Crown, Eye, EyeOff, HandHelping, Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { OrandoAgoraCard, useAgora, useUsersMap } from '@/components/oracao/OrandoAgora'
import { PedidosLista } from '@/components/oracao/PedidosOracaoDialog'
import {
  createPedidoOracao,
  deleteHorarioOracao,
  deletePedidoOracao,
  saveHorarioOracao,
  saveOracaoEquipe,
  saveOracaoOrientacoes,
  subscribeToHorariosOracao,
  subscribeToOracaoConfig,
  subscribeToPedidosOracao,
  updatePedidoOracao,
} from '@/services/firebase/oracao'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { saveSettingsParcial } from '@/services/firebase/settings'
import {
  DIAS_SEMANA_CURTOS,
  DIAS_SEMANA_NOMES,
  DURACOES_ORACAO,
  TODOS_OS_DIAS,
  estaOrando,
  formatFaixa,
  horariosDoDia,
} from '@/lib/oracao'
import { cn } from '@/lib/utils'
import type { AppUser, HorarioOracao, OracaoConfig, PedidoOracao } from '@/types'

const chipClass = (ativo: boolean) =>
  cn(
    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
    ativo ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-600',
  )

/**
 * Relógio de oração: cada pessoa escolhe seu horário (repete toda semana), a grade mostra quem ora
 * em cada dia, e o líder/assistentes da oração (definidos pelo admin) cuidam dos pedidos de oração
 * e das orientações.
 */
export function Oracao() {
  const currentUser = useAuthStore(s => s.user)
  const users = useUsersMap()
  const [config, setConfig] = useState<OracaoConfig | null>(null)
  const [horarios, setHorarios] = useState<HorarioOracao[] | null>(null)
  const [pedidos, setPedidos] = useState<PedidoOracao[] | null>(null)
  const [equipeOpen, setEquipeOpen] = useState(false)

  useEffect(() => subscribeToOracaoConfig(setConfig), [])
  useEffect(() => subscribeToHorariosOracao(setHorarios), [])
  useEffect(() => subscribeToPedidosOracao(setPedidos), [])

  const isAdmin = currentUser?.role === 'admin'
  const uid = currentUser?.uid
  const podeGerenciar =
    isAdmin || (!!uid && (config?.liderUid === uid || !!config?.assistentes?.includes(uid)))

  const nameFor = (u: string) => users[u]?.displayName ?? 'Sem nome'

  if (!config || !horarios || !currentUser) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  const meuHorario = horarios.find(h => h.uid === currentUser.uid)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Relógio de oração</h1>
      </div>

      {isAdmin && <LiberarOracaoCard />}

      <EquipeCard config={config} users={users} nameFor={nameFor} isAdmin={isAdmin} onEditar={() => setEquipeOpen(true)} />

      <OrientacoesCard config={config} podeEditar={podeGerenciar} />

      <OrandoAgoraCard />

      <MeuHorarioCard key={meuHorario?.updatedAt ?? 'novo'} uid={currentUser.uid} horario={meuHorario} />

      <GradeCard horarios={horarios} users={users} nameFor={nameFor} podeRemover={podeGerenciar} />

      <PedidosCard pedidos={pedidos} podeGerenciar={podeGerenciar} uid={currentUser.uid} />

      {isAdmin && (
        <EquipeDialog
          key={String(equipeOpen)}
          open={equipeOpen}
          onClose={() => setEquipeOpen(false)}
          config={config}
          users={users}
        />
      )}
    </div>
  )
}

// ---------- Liberar pra todos (admin) ----------

/** Liga/desliga o relógio de oração pra todo mundo (menu, página e card da Home). */
function LiberarOracaoCard() {
  const { settings, refresh } = useSettingsStore()
  const liberada = !!settings.oracaoLiberada
  const [saving, setSaving] = useState(false)

  async function alternar() {
    setSaving(true)
    try {
      await saveSettingsParcial({ oracaoLiberada: !liberada })
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={cn('border-2', liberada ? 'border-emerald-300' : 'border-amber-300')}>
      <CardContent className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            liberada ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
          )}
        >
          {liberada ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{liberada ? 'Liberado pra todos' : 'Visível só pra admins'}</p>
          <p className="text-xs text-muted-foreground">
            {liberada ? 'Aparece no menu e na Home de todo mundo.' : 'Ninguém além dos admins vê o relógio ainda.'}
          </p>
        </div>
        <Button size="sm" variant={liberada ? 'outline' : 'default'} className="shrink-0" onClick={alternar} disabled={saving}>
          {saving && <Spinner size="sm" className={liberada ? '' : 'border-white/40 border-t-white'} />}
          {liberada ? 'Esconder' : 'Liberar oração'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------- Equipe ----------

interface EquipeCardProps {
  config: OracaoConfig
  users: Record<string, AppUser>
  nameFor: (uid: string) => string
  isAdmin: boolean
  onEditar: () => void
}

function EquipeCard({ config, users, nameFor, isAdmin, onEditar }: EquipeCardProps) {
  const assistentes = config.assistentes ?? []
  if (!config.liderUid && !assistentes.length && !isAdmin) return null
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <UsersRound className="h-4 w-4 text-primary" />
            Quem cuida da oração
          </p>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditar} title="Editar equipe">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!config.liderUid && !assistentes.length ? (
          <p className="text-xs text-muted-foreground">Ninguém definido ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {config.liderUid && <PessoaFuncao uid={config.liderUid} users={users} nameFor={nameFor} funcao="lider" />}
            {assistentes.map(a => (
              <PessoaFuncao key={a} uid={a} users={users} nameFor={nameFor} funcao="assistente" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PessoaFuncao({
  uid,
  users,
  nameFor,
  funcao,
}: {
  uid: string
  users: Record<string, AppUser>
  nameFor: (uid: string) => string
  funcao: 'lider' | 'assistente'
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-8 w-8 text-xs" />
      <p className="min-w-0 flex-1 truncate text-sm">{nameFor(uid)}</p>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        {funcao === 'lider' ? (
          <>
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Líder
          </>
        ) : (
          <>
            <HandHelping className="h-3.5 w-3.5 text-primary" />
            Assistente
          </>
        )}
      </span>
    </div>
  )
}

function EquipeDialog({
  open,
  onClose,
  config,
  users,
}: {
  open: boolean
  onClose: () => void
  config: OracaoConfig
  users: Record<string, AppUser>
}) {
  const [lider, setLider] = useState(config.liderUid ?? '')
  const [assistentes, setAssistentes] = useState<string[]>(config.assistentes ?? [])
  const [novoAssistente, setNovoAssistente] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pessoas = useMemo(
    () =>
      Object.values(users)
        .filter(u => u.active !== false)
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')),
    [users],
  )

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await saveOracaoEquipe(lider || undefined, assistentes.filter(a => a !== lider))
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Quem cuida da oração">
      <div className="space-y-4">
        <div>
          <Label htmlFor="oracao-lider" className="flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Líder
          </Label>
          <Select id="oracao-lider" value={lider} onChange={e => setLider(e.target.value)}>
            <option value="">Sem líder</option>
            {pessoas.map(p => (
              <option key={p.uid} value={p.uid}>
                {p.displayName}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label className="flex items-center gap-1.5">
            <HandHelping className="h-3.5 w-3.5 text-primary" />
            Assistentes
          </Label>
          {assistentes.length > 0 && (
            <div className="mb-2 mt-1.5 space-y-1">
              {assistentes.map(a => (
                <div key={a} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{users[a]?.displayName ?? 'Sem nome'}</span>
                  <button
                    type="button"
                    onClick={() => setAssistentes(prev => prev.filter(x => x !== a))}
                    title="Remover"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Select value={novoAssistente} onChange={e => setNovoAssistente(e.target.value)}>
                <option value="">Adicionar assistente...</option>
                {pessoas
                  .filter(p => p.uid !== lider && !assistentes.includes(p.uid))
                  .map(p => (
                    <option key={p.uid} value={p.uid}>
                      {p.displayName}
                    </option>
                  ))}
              </Select>
            </div>
            <Button
              size="icon"
              disabled={!novoAssistente}
              onClick={() => {
                setAssistentes(prev => [...prev, novoAssistente])
                setNovoAssistente('')
              }}
              className="shrink-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              title="Adicionar"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>
      </div>
    </Dialog>
  )
}

// ---------- Orientações ----------

function OrientacoesCard({ config, podeEditar }: { config: OracaoConfig; podeEditar: boolean }) {
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  if (!config.orientacoes && !podeEditar) return null

  async function handleSave() {
    setSaving(true)
    try {
      await saveOracaoOrientacoes(draft)
      setEditando(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Orientações</p>
          {podeEditar && !editando && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Editar orientações"
              onClick={() => {
                setDraft(config.orientacoes ?? '')
                setEditando(true)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {editando ? (
          <>
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Ex.: ore pelo elenco, pela equipe técnica e pelas pessoas que vão assistir..."
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditando(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Salvar
              </Button>
            </div>
          </>
        ) : (
          <p className={cn('whitespace-pre-wrap text-sm', config.orientacoes ? 'text-gray-700' : 'text-muted-foreground')}>
            {config.orientacoes || 'Nenhuma orientação ainda.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Meu horário ----------

function MeuHorarioCard({ uid, horario }: { uid: string; horario?: HorarioOracao }) {
  const [inicio, setInicio] = useState(horario?.inicio ?? '')
  const [duracao, setDuracao] = useState<number>(horario?.duracaoMin ?? 30)
  const [dias, setDias] = useState<number[]>(horario?.dias ?? TODOS_OS_DIAS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dirty =
    !horario ||
    inicio !== horario.inicio ||
    duracao !== horario.duracaoMin ||
    JSON.stringify([...dias].sort()) !== JSON.stringify([...horario.dias].sort())

  function toggleDia(d: number) {
    setDias(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))
  }

  async function run(fn: () => Promise<void>) {
    setSaving(true)
    setError('')
    try {
      await fn()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Meu horário</p>
          <p className="text-xs text-muted-foreground">
            {horario ? `Você ora ${formatFaixa(horario)}.` : 'Escolha um horário pra orar — ele se repete toda semana.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="oracao-inicio">Início</Label>
            <Input id="oracao-inicio" type="time" step={300} value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div>
            <Label>Duração</Label>
            <div className="mt-1.5 flex gap-1.5">
              {DURACOES_ORACAO.map(d => (
                <button key={d} type="button" onClick={() => setDuracao(d)} className={cn(chipClass(duracao === d), 'flex-1 px-0')}>
                  {d === 60 ? '1h' : `${d}min`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>Dias</Label>
          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {TODOS_OS_DIAS.map(d => (
              <button
                key={d}
                type="button"
                title={DIAS_SEMANA_NOMES[d]}
                onClick={() => toggleDia(d)}
                className={cn(chipClass(dias.includes(d)), 'px-0')}
              >
                {DIAS_SEMANA_CURTOS[d]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          {horario && (
            <Button
              variant="outline"
              className="gap-1.5 text-red-600"
              disabled={saving}
              onClick={() => run(() => deleteHorarioOracao(uid))}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={saving || !inicio || !dias.length || !dirty}
            onClick={() => run(() => saveHorarioOracao(uid, { inicio, duracaoMin: duracao, dias: [...dias].sort() }))}
          >
            {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
            {horario ? 'Salvar alterações' : 'Quero orar nesse horário'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Grade ----------

interface GradeCardProps {
  horarios: HorarioOracao[]
  users: Record<string, AppUser>
  nameFor: (uid: string) => string
  podeRemover: boolean
}

function GradeCard({ horarios, users, nameFor, podeRemover }: GradeCardProps) {
  const agora = useAgora()
  const [dia, setDia] = useState(() => new Date().getDay())
  const doDia = horariosDoDia(horarios, dia)
  const hoje = agora.getDay()

  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="text-sm font-semibold">Quem ora em cada dia</p>
        <div className="grid grid-cols-7 gap-1">
          {TODOS_OS_DIAS.map(d => (
            <button
              key={d}
              type="button"
              title={DIAS_SEMANA_NOMES[d]}
              onClick={() => setDia(d)}
              className={cn(chipClass(dia === d), 'px-0', d === hoje && dia !== d && 'border-primary text-primary')}
            >
              {DIAS_SEMANA_CURTOS[d]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {DIAS_SEMANA_NOMES[dia]}
          {dia === hoje && ' (hoje)'} · {doDia.length} {doDia.length === 1 ? 'pessoa' : 'pessoas'}
        </p>
        {doDia.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguém escolheu esse dia ainda.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {doDia.map(h => {
              const agoraOrando = dia === hoje && estaOrando(h, agora)
              return (
                <div key={h.uid} className="flex items-center gap-2.5 py-2">
                  <span className={cn('w-24 shrink-0 font-mono text-xs', agoraOrando ? 'font-semibold text-emerald-700' : 'text-gray-500')}>
                    {formatFaixa(h)}
                  </span>
                  <Avatar
                    photoURL={users[h.uid]?.photoURL}
                    name={nameFor(h.uid)}
                    className={cn('h-7 w-7 text-[10px]', agoraOrando && 'ring-2 ring-emerald-400')}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{nameFor(h.uid)}</span>
                  {podeRemover && (
                    <button
                      type="button"
                      title="Remover horário"
                      onClick={() => deleteHorarioOracao(h.uid)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Pedidos ----------

function PedidosCard({ pedidos, podeGerenciar, uid }: { pedidos: PedidoOracao[] | null; podeGerenciar: boolean; uid: string }) {
  const [editando, setEditando] = useState<PedidoOracao | 'novo' | null>(null)
  const ativos = (pedidos ?? []).filter(p => !p.respondido)
  const respondidos = (pedidos ?? []).filter(p => p.respondido)

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Pedidos de oração</p>
          {podeGerenciar && (
            <Button size="sm" className="gap-1" onClick={() => setEditando('novo')}>
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          )}
        </div>
        {!pedidos ? (
          <Spinner size="sm" />
        ) : pedidos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum pedido de oração no momento.</p>
        ) : (
          <>
            <PedidosLista pedidos={ativos} onSelect={podeGerenciar ? setEditando : undefined} />
            {respondidos.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Respondidos
                </p>
                <PedidosLista pedidos={respondidos} onSelect={podeGerenciar ? setEditando : undefined} />
              </div>
            )}
          </>
        )}
      </CardContent>

      {editando && (
        <PedidoDialog pedido={editando === 'novo' ? undefined : editando} uid={uid} onClose={() => setEditando(null)} />
      )}
    </Card>
  )
}

function PedidoDialog({ pedido, uid, onClose }: { pedido?: PedidoOracao; uid: string; onClose: () => void }) {
  const [titulo, setTitulo] = useState(pedido?.titulo ?? '')
  const [texto, setTexto] = useState(pedido?.texto ?? '')
  const [respondido, setRespondido] = useState(!!pedido?.respondido)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <Dialog open onClose={onClose} title={pedido ? 'Editar pedido' : 'Novo pedido de oração'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="pedido-titulo">Por quem / pelo quê (opcional)</Label>
          <Input id="pedido-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Família da Ana" />
        </div>
        <div>
          <Label htmlFor="pedido-texto">Pedido</Label>
          <Textarea
            id="pedido-texto"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="mt-1.5"
            placeholder="Ex.: saúde e recuperação da cirurgia"
            autoFocus
          />
        </div>
        {pedido && (
          <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
            <span className="text-sm text-gray-700">Oração respondida</span>
            <input
              type="checkbox"
              checked={respondido}
              onChange={e => setRespondido(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          className="w-full"
          disabled={saving || !texto.trim()}
          onClick={() =>
            run(() =>
              pedido ? updatePedidoOracao(pedido.id, { titulo, texto, respondido }) : createPedidoOracao({ titulo, texto }, uid),
            )
          }
        >
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>

        {pedido &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir esse pedido?</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => run(() => deletePedidoOracao(pedido.id))} disabled={saving}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Excluir pedido
            </Button>
          ))}
      </div>
    </Dialog>
  )
}
