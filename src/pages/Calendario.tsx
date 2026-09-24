import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Crown, MapPin, Shirt, Star } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToCenas } from '@/services/firebase/cenas'
import { subscribeToAllEnsaios } from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import { type AppUser, type Cena, type DiaSemana, type Ensaio, type Inscricao } from '@/types'
import { DIA_TO_WEEKDAY, addDays, monthMatrix, toDateKey, weekDates } from '@/lib/agenda'
import { formatHoraCompacta, horarioDoDia } from '@/lib/cenaHorario'
import { DIAS_ORDER } from '@/lib/dias'
import { cn } from '@/lib/utils'
import { ensaioStatus } from '@/lib/ensaioStatus'
import { EnsaioStatusChip } from '@/components/ensaio/EnsaioStatusChip'

type Visao = 'semana' | 'mes'

type Status = 'confirmado' | 'previsto' | 'cancelado'

interface Ocorrencia {
  key: string
  /** YYYY-MM-DD */
  data: string
  cena: Cena
  horario?: string
  status: Status
  ensaio?: Ensaio
}

const WEEKDAY_TO_DIA = Object.fromEntries(DIAS_ORDER.map(d => [DIA_TO_WEEKDAY[d], d])) as Record<number, DiaSemana>

const MES_WEEKDAY_HEADERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const STATUS_DOT: Record<Status, string> = {
  confirmado: 'bg-primary',
  previsto: 'bg-gray-300',
  cancelado: 'bg-red-400',
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Calendário geral dos ensaios (só admin), em visão semanal ou mensal. Mostra os ensaios
 * confirmados (e os cancelados, riscados) e — de hoje em diante — os "previstos": dias da agenda
 * de cada cena ativa que ainda não têm ensaio confirmado nem cancelado naquela data. Tocar em
 * qualquer ensaio abre a página dele — um previsto abre pela data (ainda sem documento).
 */
export function Calendario() {
  const currentUser = useAuthStore(s => s.user)
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [ensaios, setEnsaios] = useState<Ensaio[] | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([])
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [visao, setVisao] = useState<Visao>('semana')
  const [base, setBase] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()))

  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, setCenas)
  }, [currentUser])
  useEffect(() => subscribeToAllEnsaios(setEnsaios), [])
  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])
  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const inscricoesByUid = useMemo(() => Object.fromEntries(inscricoes.map(i => [i.uid, i])), [inscricoes])

  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  const todayKey = toDateKey(new Date())

  const dates = useMemo(() => {
    if (visao === 'semana') return weekDates(base)
    const y = base.getFullYear()
    const m = base.getMonth()
    return Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => new Date(y, m, i + 1))
  }, [visao, base])

  const cenasById = useMemo(() => new Map((cenas ?? []).map(c => [c.id, c])), [cenas])

  /** Ensaios (confirmados/cancelados) por data, só das cenas que ainda existem. */
  const ensaiosPorData = useMemo(() => {
    const map = new Map<string, Ensaio[]>()
    for (const e of ensaios ?? []) {
      if (!cenasById.has(e.cenaId)) continue
      map.set(e.data, [...(map.get(e.data) ?? []), e])
    }
    return map
  }, [ensaios, cenasById])

  const ocorrenciasPorData = useMemo(() => {
    const map = new Map<string, Ocorrencia[]>()
    for (const date of dates) {
      const key = toDateKey(date)
      const doDia = ensaiosPorData.get(key) ?? []
      const itens: Ocorrencia[] = doDia.map(e => ({
        key: e.id,
        data: key,
        cena: cenasById.get(e.cenaId)!,
        horario: e.horario,
        status: e.canceledByUid ? 'cancelado' : 'confirmado',
        ensaio: e,
      }))

      const dia = WEEKDAY_TO_DIA[date.getDay()]
      if (dia && key >= todayKey) {
        const comEnsaio = new Set(doDia.map(e => e.cenaId))
        for (const cena of cenas ?? []) {
          if (!cena.ativo || !cena.dias.includes(dia) || comEnsaio.has(cena.id)) continue
          if (cena.inicioEnsaios && key < cena.inicioEnsaios) continue
          itens.push({ key: `${cena.id}-${key}`, data: key, cena, horario: horarioDoDia(cena, dia), status: 'previsto' })
        }
      }

      itens.sort((a, b) => (a.horario ?? '99').localeCompare(b.horario ?? '99') || a.cena.nome.localeCompare(b.cena.nome, 'pt-BR'))
      map.set(key, itens)
    }
    return map
  }, [dates, ensaiosPorData, cenas, cenasById, todayKey])

  function navegar(delta: number) {
    const next = visao === 'semana' ? addDays(base, delta * 7) : new Date(base.getFullYear(), base.getMonth() + delta, 1)
    setBase(next)
    if (visao === 'mes') setSelectedKey(toDateKey(next))
  }

  function irParaHoje() {
    const hoje = new Date()
    setBase(hoje)
    setSelectedKey(toDateKey(hoje))
  }

  /** Semana → mês abre no mês da semana que estava na tela; mês → semana abre na semana do dia selecionado. */
  function trocarVisao(v: Visao) {
    if (v === visao) return
    setVisao(v)
    if (v === 'mes') {
      const semana = weekDates(base)
      const alvo = semana.find(d => toDateKey(d) === todayKey) ?? semana[0]
      setSelectedKey(toDateKey(alvo))
      setBase(alvo)
    } else {
      setBase(new Date(`${selectedKey}T00:00:00`))
    }
  }

  const titulo =
    visao === 'mes'
      ? capitalize(base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
      : (() => {
          const [ini, fim] = [dates[0], dates[dates.length - 1]]
          const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
          return `${fmt(ini)} – ${fmt(fim)}`
        })()

  const loading = !cenas || !ensaios

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Calendário</h1>
      </div>

      <div className="flex rounded-full border border-white/30 bg-white/10 p-1">
        {(['semana', 'mes'] as Visao[]).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => trocarVisao(v)}
            className={cn(
              'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
              visao === v ? 'bg-white text-gray-900' : 'text-white',
            )}
          >
            {v === 'semana' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navegar(-1)} title="Anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-base font-semibold text-white">{titulo}</p>
          <button type="button" onClick={irParaHoje} className="text-xs text-white/70 underline-offset-2 hover:underline">
            Hoje
          </button>
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navegar(1)} title="Próximo">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <Legenda />

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : visao === 'semana' ? (
        <div className="space-y-2">
          {dates.map(date => {
            const key = toDateKey(date)
            const itens = ocorrenciasPorData.get(key) ?? []
            return (
              <Card key={key} className={cn('p-3', key === todayKey && 'ring-2 ring-primary')}>
                <p className={cn('mb-1 text-sm font-semibold', key < todayKey && 'text-gray-400')}>
                  {capitalize(date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }))}
                  {key === todayKey && <span className="ml-1.5 text-xs font-medium text-primary">Hoje</span>}
                </p>
                <ListaDoDia itens={itens} nameFor={nameFor} users={users} />
              </Card>
            )
          })}
        </div>
      ) : (
        <>
          <Card className="p-2">
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
              {MES_WEEKDAY_HEADERS.map((h, i) => (
                <span key={i} className="py-1">
                  {h}
                </span>
              ))}
            </div>
            {monthMatrix(base.getFullYear(), base.getMonth()).map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  if (!day) return <span key={di} />
                  const key = toDateKey(new Date(base.getFullYear(), base.getMonth(), day))
                  const itens = ocorrenciasPorData.get(key) ?? []
                  const isSelected = key === selectedKey
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={cn(
                        'flex h-12 flex-col items-center justify-start gap-1 rounded-xl pt-1.5 text-sm',
                        isSelected ? 'bg-primary text-white' : 'hover:bg-gray-50',
                        !isSelected && key === todayKey && 'font-bold text-primary',
                        !isSelected && key < todayKey && 'text-gray-400',
                      )}
                    >
                      {day}
                      <span className="flex gap-0.5">
                        {itens.slice(0, 4).map(o => (
                          <span
                            key={o.key}
                            className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-white' : STATUS_DOT[o.status])}
                          />
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </Card>

          <Card className="p-3">
            <p className="mb-1 text-sm font-semibold">
              {capitalize(new Date(`${selectedKey}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}
            </p>
            <ListaDoDia itens={ocorrenciasPorData.get(selectedKey) ?? []} nameFor={nameFor} users={users} />
          </Card>
        </>
      )}
    </div>
  )
}

function Legenda() {
  const itens: { status: Status; label: string }[] = [
    { status: 'confirmado', label: 'Confirmado' },
    { status: 'previsto', label: 'Previsto' },
    { status: 'cancelado', label: 'Cancelado' },
  ]
  return (
    <div className="flex justify-center gap-4 text-xs text-white/80">
      {itens.map(i => (
        <span key={i.status} className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[i.status])} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

interface ListaDoDiaProps {
  itens: Ocorrencia[]
  nameFor: (uid: string) => string
  users: Record<string, AppUser>
}

function ListaDoDia({ itens, nameFor, users }: ListaDoDiaProps) {
  const todayKey = toDateKey(new Date())
  if (!itens.length) return <p className="text-xs text-muted-foreground">Nenhum ensaio.</p>

  return (
    <div className="divide-y divide-gray-100">
      {itens.map(o => {
        const lider = o.cena.liderUid
        return (
          <Link key={o.key} to={o.ensaio ? `/cenas/${o.cena.id}/ensaios/${o.ensaio.id}` : `/cenas/${o.cena.id}/ensaios/dia/${o.data}`} className="flex items-center gap-3 py-2">
            <div className={cn('w-11 shrink-0 text-sm font-semibold', o.status === 'confirmado' ? 'text-primary' : 'text-gray-400')}>
              {o.horario ? formatHoraCompacta(o.horario) : '—'}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium',
                  o.status === 'cancelado' && 'text-gray-400 line-through',
                  o.status === 'previsto' && 'text-gray-500',
                )}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[o.status])} />
                <span className="truncate">{o.cena.nome}</span>
                {o.ensaio?.geral && <Star className="h-3 w-3 shrink-0 text-amber-500" aria-label="Ensaio geral" />}
                {o.ensaio?.comFigurino && <Shirt className="h-3 w-3 shrink-0 text-violet-500" aria-label="Com figurino" />}
              </p>
              <p className="flex items-center gap-1 text-xs text-gray-500">
                {lider ? (
                  <>
                    <Avatar photoURL={users[lider]?.photoURL} name={nameFor(lider)} className="h-4 w-4 text-[8px]" />
                    <Crown className="h-3 w-3 shrink-0 text-amber-500" />
                    <span className="truncate">{nameFor(lider)}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Sem líder</span>
                )}
              </p>
              {o.ensaio?.local && (
                <p className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{o.ensaio.local}</span>
                </p>
              )}
            </div>
            <EnsaioStatusChip status={ensaioStatus(o.ensaio, todayKey)} />
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
          </Link>
        )
      })}
    </div>
  )
}
