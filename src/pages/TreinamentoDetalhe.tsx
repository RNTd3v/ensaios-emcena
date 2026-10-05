import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Backpack, Check, ChevronDown, Drama, MapPin, Pencil, Shirt, UserCheck, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/Spinner'
import { PessoaLinha } from '@/components/ui/PessoaLinha'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { RespostaPresenca } from '@/components/ensaio/RespostaPresenca'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { useEhElenco } from '@/hooks/useTreinamentos'
import { subscribeToTodasCenas } from '@/services/firebase/cenas'
import {
  subscribeToAusenciasSessao,
  subscribeToTodasSessoes,
  subscribeToTreinamentos,
  treinamentoValePara,
  uidsDoElenco,
} from '@/services/firebase/treinamentos'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { cn } from '@/lib/utils'
import { TreinamentoDialog } from '@/pages/Treinamentos'
import type { AppUser, AusenciaMotivo, Cena, Treinamento, TreinamentoSessao } from '@/types'

export function TreinamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const ehElenco = useEhElenco(user?.uid ?? '')
  const { settings } = useSettingsStore()
  const [treinamentos, setTreinamentos] = useState<Treinamento[] | null>(null)
  const [todasSessoes, setTodasSessoes] = useState<TreinamentoSessao[]>([])
  const [editando, setEditando] = useState(false)
  const todayKey = toDateKey(new Date())

  useEffect(() => subscribeToTreinamentos(setTreinamentos), [])
  useEffect(() => subscribeToTodasSessoes(setTodasSessoes), [])

  const treinamento = treinamentos?.find(t => t.id === id)
  const sessoes = useMemo(() => todasSessoes.filter(s => s.treinamentoId === id), [todasSessoes, id])
  const participa = !!treinamento && !!user && treinamentoValePara(treinamento, user.uid, ehElenco)

  // Admin: quem deveria responder (o mesmo público que a notificação usa).
  const users = useUsersMap()
  const [cenas, setCenas] = useState<Cena[]>([])
  useEffect(() => (isAdmin ? subscribeToTodasCenas(setCenas) : undefined), [isAdmin])
  const publico = useMemo(() => {
    if (!isAdmin || !treinamento) return []
    const uids =
      treinamento.publico === 'elenco'
        ? [...uidsDoElenco(cenas)]
        : treinamento.publico === 'pessoas'
          ? (treinamento.pessoas ?? [])
          : Object.values(users).filter(u => u.active).map(u => u.uid)
    return uids.filter(u => users[u])
  }, [isAdmin, treinamento, cenas, users])

  if (!treinamentos) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  if (!treinamento) {
    return (
      <div className="space-y-4">
        <Cabecalho titulo="Treinamento" />
        <p className="py-6 text-center text-sm text-white/80">Esse treinamento não existe mais.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo={treinamento.titulo}>
        {isAdmin && (
          <Button size="icon" title="Editar treinamento" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </Cabecalho>

      <Card>
        <CardContent className="space-y-2">
          {treinamento.descricao && <p className="whitespace-pre-wrap text-sm text-gray-800">{treinamento.descricao}</p>}
          <Info icone={MapPin} rotulo="Local" valor={treinamento.local} />
          <Info icone={Shirt} rotulo="Roupa" valor={treinamento.roupa} />
          <Info icone={Backpack} rotulo="Levar" valor={treinamento.levar} />
          <Info
            icone={treinamento.publico === 'elenco' ? Drama : treinamento.publico === 'pessoas' ? UserCheck : Users}
            rotulo="Pra quem"
            valor={
              treinamento.publico === 'elenco'
                ? 'Só elenco'
                : treinamento.publico === 'pessoas'
                  ? `${treinamento.pessoas?.length ?? 0} pessoas escolhidas`
                  : 'Todos'
            }
          />
        </CardContent>
      </Card>

      {sessoes.map(s => (
        <Card key={s.id}>
          <CardContent className="space-y-3">
            <p className="text-lg font-bold text-gray-900">
              {formatRelativeDia(s.data, todayKey)} · {formatHoraCompacta(s.horario)}
            </p>
            {participa && user && (
              <RespostaPresenca ensaio={s} uid={user.uid} checkinLimiteHoras={settings.checkinLimiteHoras ?? 2} tipo="treinamento" />
            )}
            {isAdmin && <RespostasSessao sessao={s} publico={publico} users={users} />}
          </CardContent>
        </Card>
      ))}

      {editando && <TreinamentoDialog treinamento={treinamento} sessoes={sessoes} onClose={() => setEditando(false)} />}
    </div>
  )
}

function Cabecalho({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Link to="/treinamentos">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="truncate text-xl font-semibold text-white">{titulo}</h1>
      </div>
      {children}
    </div>
  )
}

function Info({ icone: Icone, rotulo, valor }: { icone: React.ComponentType<{ className?: string }>; rotulo: string; valor?: string }) {
  if (!valor) return null
  return (
    <p className="flex items-start gap-2 text-sm text-gray-700">
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        <span className="font-medium">{rotulo}:</span> {valor}
      </span>
    </p>
  )
}

/** Admin: quem vai, quem não vai (com o motivo) e quem ainda não respondeu, numa sessão. */
function RespostasSessao({ sessao, publico, users }: { sessao: TreinamentoSessao; publico: string[]; users: Record<string, AppUser> }) {
  const [aberto, setAberto] = useState(false)
  const [motivos, setMotivos] = useState<Record<string, AusenciaMotivo>>({})
  useEffect(() => (aberto ? subscribeToAusenciasSessao(sessao.id, setMotivos) : undefined), [aberto, sessao.id])

  const vao = sessao.presencas ?? []
  const naoVao = sessao.ausentes ?? []
  const semResposta = publico.filter(u => !vao.includes(u) && !naoVao.includes(u))

  const grupos: { titulo: string; uids: string[]; cor: string }[] = [
    { titulo: 'Vão', uids: vao, cor: 'text-emerald-700' },
    { titulo: 'Não vão', uids: naoVao, cor: 'text-red-700' },
    { titulo: 'Sem resposta', uids: semResposta, cor: 'text-gray-500' },
  ]

  return (
    <div className="border-t border-gray-100 pt-3">
      <button type="button" onClick={() => setAberto(v => !v)} className="flex w-full items-center gap-3 text-left text-xs">
        <span className="flex items-center gap-1 font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          {vao.length}
        </span>
        <span className="flex items-center gap-1 font-medium text-red-700">
          <X className="h-3.5 w-3.5" />
          {naoVao.length}
        </span>
        <span className="text-gray-500">{semResposta.length} sem resposta</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-gray-400 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="mt-3 space-y-3">
          {grupos
            .filter(g => g.uids.length)
            .map(g => (
              <div key={g.titulo}>
                <p className={cn('mb-1 text-xs font-semibold uppercase tracking-wide', g.cor)}>
                  {g.titulo} ({g.uids.length})
                </p>
                <div className="space-y-1">
                  {g.uids.map(uid => (
                    <PessoaLinha key={uid} pessoa={pessoaOpcao(uid, users[uid])} detalhe={motivos[uid]?.motivo} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
