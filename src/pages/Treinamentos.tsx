import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Drama, GraduationCap, Plus, Trash2, UserCheck, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { EscolherPessoas } from '@/components/ui/EscolherPessoas'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { useEhElenco } from '@/hooks/useTreinamentos'
import { subscribeToTodasCenas } from '@/services/firebase/cenas'
import { subscribeToEquipes } from '@/services/firebase/equipes'
import { subscribeToLocais } from '@/services/firebase/locais'
import {
  createTreinamento,
  deleteTreinamento,
  subscribeToTodasSessoes,
  subscribeToTreinamentos,
  treinamentoValePara,
  updateTreinamento,
  type SessaoInput,
} from '@/services/firebase/treinamentos'
import { useAuthStore } from '@/stores/authStore'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { localIcon } from '@/lib/localIcons'
import { cn } from '@/lib/utils'
import type { Cena, Equipe, LocalEnsaio, Treinamento, TreinamentoPublico, TreinamentoSessao } from '@/types'

/**
 * Treinamentos: o admin cadastra (dias/horários, roupa, o que levar, pra quem: todos, só o elenco ou
 * pessoas escolhidas) e quem participa vê os que valem pra si. Ao cadastrar, a Cloud Function `treinamentoCriado` avisa as
 * pessoas pra confirmarem presença.
 */
export function Treinamentos() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const ehElenco = useEhElenco(user?.uid ?? '')
  const [treinamentos, setTreinamentos] = useState<Treinamento[] | null>(null)
  const [sessoes, setSessoes] = useState<TreinamentoSessao[]>([])
  const [novoOpen, setNovoOpen] = useState(false)
  const todayKey = toDateKey(new Date())

  useEffect(() => subscribeToTreinamentos(setTreinamentos), [])
  useEffect(() => subscribeToTodasSessoes(setSessoes), [])

  const { proximos, anteriores } = useMemo(() => {
    const visiveis = (treinamentos ?? []).filter(t => isAdmin || treinamentoValePara(t, user?.uid ?? '', ehElenco))
    const comSessoes = visiveis.map(t => ({ treinamento: t, sessoes: sessoes.filter(s => s.treinamentoId === t.id) }))
    const primeiraFutura = (l: TreinamentoSessao[]) => l.find(s => s.data >= todayKey)
    return {
      proximos: comSessoes
        .filter(i => primeiraFutura(i.sessoes))
        .sort((a, b) => primeiraFutura(a.sessoes)!.data.localeCompare(primeiraFutura(b.sessoes)!.data)),
      anteriores: comSessoes
        .filter(i => !primeiraFutura(i.sessoes))
        .sort((a, b) => (b.sessoes.at(-1)?.data ?? '').localeCompare(a.sessoes.at(-1)?.data ?? '')),
    }
  }, [treinamentos, sessoes, isAdmin, user?.uid, ehElenco, todayKey])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-white">Treinamentos</h1>
        </div>
        {isAdmin && (
          <Button size="icon" title="Novo treinamento" onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!treinamentos ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : proximos.length === 0 && anteriores.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/80">Nenhum treinamento marcado por enquanto.</p>
      ) : (
        <>
          {proximos.length > 0 && <ListaTreinamentos itens={proximos} todayKey={todayKey} />}
          {anteriores.length > 0 && (
            <>
              <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-white/60">Anteriores</p>
              <ListaTreinamentos itens={anteriores} todayKey={todayKey} />
            </>
          )}
        </>
      )}

      {novoOpen && <TreinamentoDialog onClose={() => setNovoOpen(false)} />}
    </div>
  )
}

function ListaTreinamentos({ itens, todayKey }: { itens: { treinamento: Treinamento; sessoes: TreinamentoSessao[] }[]; todayKey: string }) {
  return (
    <Card className="p-2">
      {itens.map(({ treinamento: t, sessoes }) => {
        const proxima = sessoes.find(s => s.data >= todayKey) ?? sessoes.at(-1)
        return (
          <Link key={t.id} to={`/treinamentos/${t.id}`} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-gray-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.titulo}</p>
              <p className="truncate text-xs text-gray-500">
                {proxima ? `${formatRelativeDia(proxima.data, todayKey)} · ${formatHoraCompacta(proxima.horario)}` : 'Sem dias marcados'}
                {sessoes.length > 1 && ` · ${sessoes.length} dias`}
                {t.publico === 'elenco' && ' · Só elenco'}
                {t.publico === 'pessoas' && ` · ${t.pessoas?.length ?? 0} pessoas`}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
          </Link>
        )
      })}
    </Card>
  )
}

const PUBLICOS: { value: TreinamentoPublico; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'todos', label: 'Todos', icon: Users },
  { value: 'elenco', label: 'Só elenco', icon: Drama },
  { value: 'pessoas', label: 'Escolher pessoas', icon: UserCheck },
]

interface TreinamentoDialogProps {
  treinamento?: Treinamento
  sessoes?: TreinamentoSessao[]
  onClose: () => void
}

/** Cadastro/edição de um treinamento (só admin). */
export function TreinamentoDialog({ treinamento, sessoes: existentes = [], onClose }: TreinamentoDialogProps) {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [titulo, setTitulo] = useState(treinamento?.titulo ?? '')
  const [descricao, setDescricao] = useState(treinamento?.descricao ?? '')
  const [local, setLocal] = useState(treinamento?.local ?? '')
  const [roupa, setRoupa] = useState(treinamento?.roupa ?? '')
  const [levar, setLevar] = useState(treinamento?.levar ?? '')
  const [publico, setPublico] = useState<TreinamentoPublico>(treinamento?.publico ?? 'todos')
  const [pessoas, setPessoas] = useState<string[]>(treinamento?.pessoas ?? [])
  const [sessoes, setSessoes] = useState<SessaoInput[]>(() =>
    existentes.length ? existentes.map(s => ({ data: s.data, horario: s.horario })) : [{ data: '', horario: '' }],
  )
  const [locais, setLocais] = useState<LocalEnsaio[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => subscribeToLocais(setLocais), [])

  // Pra escolher pessoas (filtro por cena/equipe no seletor).
  const users = useUsersMap()
  const [cenas, setCenas] = useState<Cena[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  useEffect(() => subscribeToTodasCenas(l => setCenas(l.filter(c => c.ativo))), [])
  useEffect(() => subscribeToEquipes(setEquipes), [])

  function setSessao(i: number, campo: keyof SessaoInput, valor: string) {
    setSessoes(lista => lista.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)))
  }

  async function handleSave() {
    if (!user) return
    if (!titulo.trim()) return setError('Preencha o título.')
    if (!sessoes.length || sessoes.some(s => !s.data || !s.horario)) return setError('Preencha a data e o horário de cada dia.')
    if (new Set(sessoes.map(s => s.data)).size !== sessoes.length) return setError('Tem dia repetido — um horário por dia.')
    if (publico === 'pessoas' && !pessoas.length) return setError('Escolha pelo menos uma pessoa.')
    setSaving(true)
    setError('')
    const input = { titulo, descricao, local, roupa, levar, publico, pessoas }
    const ordenadas = [...sessoes].sort((a, b) => a.data.localeCompare(b.data))
    try {
      if (treinamento) {
        await updateTreinamento(treinamento.id, input, ordenadas, existentes)
        onClose()
      } else {
        const id = await createTreinamento(input, ordenadas, user.uid)
        navigate(`/treinamentos/${id}`)
      }
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!treinamento) return
    setSaving(true)
    try {
      await deleteTreinamento(treinamento.id, existentes)
      navigate('/treinamentos')
    } catch {
      setError('Não foi possível excluir. Tente de novo.')
      setSaving(false)
    }
  }

  const chip = (ativo: boolean) =>
    cn(
      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
      ativo ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
    )

  return (
    <Dialog open onClose={onClose} title={treinamento ? 'Editar treinamento' : 'Novo treinamento'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="treino-titulo">Título</Label>
          <Input id="treino-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Oficina de expressão corporal" autoFocus />
        </div>
        <div>
          <Label htmlFor="treino-descricao">Descrição</Label>
          <Textarea
            id="treino-descricao"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="mt-1.5"
            placeholder="O que vai acontecer no treinamento"
          />
        </div>

        <div>
          <Label>Dias e horários</Label>
          <div className="mt-1.5 space-y-2">
            {sessoes.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="date" value={s.data} onChange={e => setSessao(i, 'data', e.target.value)} className="flex-[3]" />
                <Input type="time" value={s.horario} onChange={e => setSessao(i, 'horario', e.target.value)} className="flex-[2]" />
                <button
                  type="button"
                  title="Remover dia"
                  onClick={() => setSessoes(lista => lista.filter((_, j) => j !== i))}
                  disabled={sessoes.length === 1}
                  className="shrink-0 p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setSessoes(lista => [...lista, { data: '', horario: lista.at(-1)?.horario ?? '' }])}
            >
              <Plus className="h-4 w-4" />
              Adicionar dia
            </Button>
          </div>
          {treinamento && (
            <p className="mt-1 text-[11px] text-muted-foreground">Ao remover um dia, as respostas de presença dele são apagadas.</p>
          )}
        </div>

        <div>
          <Label htmlFor="treino-local">Local</Label>
          <Input
            id="treino-local"
            value={local}
            onChange={e => setLocal(e.target.value)}
            placeholder={locais.length ? 'Escolha abaixo ou digite um local' : 'Ex.: Salão da igreja'}
          />
          {locais.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {locais.map(l => {
                const Icon = localIcon(l.icone)
                const selecionado = local.trim().toLowerCase() === l.nome.trim().toLowerCase()
                return (
                  <button key={l.id} type="button" onClick={() => setLocal(selecionado ? '' : l.nome)} className={chip(selecionado)}>
                    <Icon className="h-3.5 w-3.5" />
                    {l.nome}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="treino-roupa">Tipo de roupa</Label>
          <Input id="treino-roupa" value={roupa} onChange={e => setRoupa(e.target.value)} placeholder="Ex.: Roupa confortável e tênis" />
        </div>
        <div>
          <Label htmlFor="treino-levar">O que levar</Label>
          <Input id="treino-levar" value={levar} onChange={e => setLevar(e.target.value)} placeholder="Ex.: Garrafa d'água e toalha" />
        </div>

        <div>
          <Label>Pra quem</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PUBLICOS.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setPublico(value)} className={chip(publico === value)}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {!treinamento && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {publico === 'elenco' ? 'Quem tem personagem em alguma cena' : publico === 'pessoas' ? 'Só as pessoas escolhidas' : 'Todos os inscritos'}{' '}
              vão receber uma notificação pra confirmar presença.
            </p>
          )}
        </div>

        {publico === 'pessoas' && (
          <EscolherPessoas isAdmin users={users} cenas={cenas} equipes={equipes} escolhidos={pessoas} onChange={setPessoas} />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full" onClick={handleSave} disabled={saving || !titulo.trim() || (publico === 'pessoas' && !pessoas.length)}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          {treinamento ? 'Salvar' : 'Cadastrar e avisar'}
        </Button>

        {treinamento &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir "{treinamento.titulo}"? Todas as respostas de presença são apagadas.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={saving}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Excluir treinamento
            </Button>
          ))}
      </div>
    </Dialog>
  )
}
