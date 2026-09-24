import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, BellRing, CalendarClock, CheckCheck, ListChecks, Megaphone, Send, Shirt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { subscribeToCenas } from '@/services/firebase/cenas'
import { subscribeToEquipes } from '@/services/firebase/equipes'
import {
  ativarPush,
  ehIOS,
  enviarAviso,
  estadoPush,
  marcarLida,
  marcarTodasLidas,
  rodandoComoApp,
  subscribeToNotificacoes,
  type AvisoInput,
  type PushEstado,
} from '@/services/firebase/notificacoes'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { Cena, Equipe, Notificacao } from '@/types'

const ICONE: Record<Notificacao['tipo'], typeof Bell> = {
  ensaio: CalendarClock,
  figurino: Shirt,
  tarefa: ListChecks,
  aviso: Megaphone,
}

function quandoRelativo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Notificações da pessoa (ensaios, figurino, tarefas, avisos) — criadas pelas Cloud Functions.
 * Aqui também se ativa o push no aparelho e, pra admin/líderes, se envia um aviso.
 */
export function Notificacoes() {
  const currentUser = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [lista, setLista] = useState<Notificacao[] | null>(null)
  const [avisoOpen, setAvisoOpen] = useState(false)
  const [cenas, setCenas] = useState<Cena[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])

  const uid = currentUser?.uid
  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    if (!uid) return
    return subscribeToNotificacoes(uid, setLista)
  }, [uid])

  // Grupos em que a pessoa pode mandar aviso: admin = todos; líder = as cenas/equipes que lidera.
  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, l => setCenas(l.filter(c => c.ativo)))
  }, [currentUser])
  useEffect(() => subscribeToEquipes(setEquipes), [])
  const cenasQueLidera = useMemo(() => cenas.filter(c => isAdmin || c.liderUid === uid), [cenas, isAdmin, uid])
  const equipesQueLidera = useMemo(() => equipes.filter(e => isAdmin || e.liderUid === uid), [equipes, isAdmin, uid])
  const podeAvisar = isAdmin || cenasQueLidera.length > 0 || equipesQueLidera.length > 0

  const naoLidas = (lista ?? []).filter(n => !n.lida)

  function voltar() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/')
  }

  async function abrir(n: Notificacao) {
    if (!n.lida) marcarLida(n.id).catch(() => {})
    if (n.link) navigate(n.link)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={voltar} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Notificações</h1>
        </div>
        {podeAvisar && (
          <Button size="sm" className="gap-1" onClick={() => setAvisoOpen(true)}>
            <Send className="h-4 w-4" />
            Enviar aviso
          </Button>
        )}
      </div>

      {uid && <PushCard uid={uid} />}

      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {naoLidas.length ? `${naoLidas.length} não lida${naoLidas.length === 1 ? '' : 's'}` : 'Tudo em dia'}
            </p>
            {naoLidas.length > 0 && (
              <button
                type="button"
                onClick={() => marcarTodasLidas(naoLidas.map(n => n.id))}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {!lista ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : lista.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {lista.map(n => {
                const Icone = ICONE[n.tipo] ?? Bell
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => abrir(n)}
                    className={cn('flex w-full items-start gap-3 py-3 text-left', !n.lida && 'bg-primary/5 -mx-2 rounded-xl px-2')}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        n.lida ? 'bg-gray-100 text-gray-500' : 'bg-primary/15 text-primary',
                      )}
                    >
                      <Icone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn('text-sm', n.lida ? 'font-medium text-gray-700' : 'font-semibold text-gray-900')}>{n.titulo}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{quandoRelativo(n.createdAt)}</span>
                      </div>
                      {n.corpo && <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-600">{n.corpo}</p>}
                    </div>
                    {!n.lida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {avisoOpen && uid && (
        <AvisoDialog
          uid={uid}
          isAdmin={isAdmin}
          cenas={cenasQueLidera}
          equipes={equipesQueLidera}
          onClose={() => setAvisoOpen(false)}
        />
      )}
    </div>
  )
}

/** Ativar o push neste aparelho — com a explicação certa pra cada situação (iPhone, bloqueado...). */
function PushCard({ uid }: { uid: string }) {
  const [estado, setEstado] = useState<PushEstado | null>(null)
  const [ativando, setAtivando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    estadoPush().then(setEstado, () => setEstado('sem-suporte'))
  }, [])

  if (!estado || estado === 'ativo') {
    return estado === 'ativo' ? (
      <p className="flex items-center justify-center gap-1.5 text-xs text-white/80">
        <BellRing className="h-3.5 w-3.5" />
        Notificações ativadas neste aparelho.
      </p>
    ) : null
  }

  const iphoneSemInstalar = estado === 'sem-suporte' && ehIOS() && !rodandoComoApp()

  async function ativar() {
    setAtivando(true)
    setErro('')
    try {
      setEstado(await ativarPush(uid))
    } catch {
      setErro('Não foi possível ativar agora. Tente de novo.')
    } finally {
      setAtivando(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <BellRing className="h-4 w-4 text-primary" />
          Receber avisos no celular
        </p>
        {iphoneSemInstalar ? (
          <p className="text-xs text-muted-foreground">
            No iPhone, o aviso só chega com o app instalado: toque em Compartilhar → <strong>Adicionar à Tela de Início</strong>, abra o app
            por lá e volte aqui pra ativar.
          </p>
        ) : estado === 'sem-suporte' ? (
          <p className="text-xs text-muted-foreground">Este navegador não aceita notificações. Tente pelo Chrome ou com o app instalado.</p>
        ) : estado === 'negado' ? (
          <p className="text-xs text-muted-foreground">
            As notificações estão bloqueadas pra este app. Libere nas configurações do navegador/celular e volte aqui.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Ensaios confirmados ou cancelados, lembretes, figurinos, tarefas e avisos.</p>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <Button className="w-full gap-1.5" onClick={ativar} disabled={ativando}>
              {ativando ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Bell className="h-4 w-4" />}
              Ativar notificações
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AvisoDialog({
  uid,
  isAdmin,
  cenas,
  equipes,
  onClose,
}: {
  uid: string
  isAdmin: boolean
  cenas: Cena[]
  equipes: Equipe[]
  onClose: () => void
}) {
  // Destino codificado como "todos" | "cena:<id>" | "equipe:<id>".
  const primeiro = isAdmin ? 'todos' : cenas[0] ? `cena:${cenas[0].id}` : equipes[0] ? `equipe:${equipes[0].id}` : ''
  const [destino, setDestino] = useState(primeiro)
  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function handleEnviar() {
    if (!titulo.trim()) return setErro('Escreva um título.')
    if (!corpo.trim()) return setErro('Escreva a mensagem.')
    const [tipo, id] = destino.split(':')
    const input: AvisoInput =
      tipo === 'cena'
        ? { titulo, corpo, escopo: 'cena', escopoId: id, escopoNome: cenas.find(c => c.id === id)?.nome }
        : tipo === 'equipe'
          ? { titulo, corpo, escopo: 'equipe', escopoId: id, escopoNome: equipes.find(e => e.id === id)?.nome }
          : { titulo, corpo, escopo: 'todos' }
    setEnviando(true)
    setErro('')
    try {
      await enviarAviso(input, uid)
      setEnviado(true)
    } catch {
      setErro('Não foi possível enviar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Enviar aviso">
      {enviado ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Aviso enviado. As pessoas recebem no app e, quem ativou, no celular.</p>
          <Button className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="aviso-destino">Para quem</Label>
            <Select id="aviso-destino" value={destino} onChange={e => setDestino(e.target.value)}>
              {isAdmin && <option value="todos">Todo mundo</option>}
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
          </div>
          <div>
            <Label htmlFor="aviso-titulo">Título</Label>
            <Input id="aviso-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Ensaio geral no sábado" maxLength={80} autoFocus />
          </div>
          <div>
            <Label htmlFor="aviso-corpo">Mensagem</Label>
            <Textarea
              id="aviso-corpo"
              value={corpo}
              onChange={e => setCorpo(e.target.value)}
              className="mt-1.5"
              maxLength={500}
              placeholder="Ex.: Todos com figurino completo, às 15h no templo."
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button className="w-full gap-1.5" onClick={handleEnviar} disabled={enviando || !destino}>
            {enviando ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}
            Enviar
          </Button>
        </div>
      )}
    </Dialog>
  )
}
