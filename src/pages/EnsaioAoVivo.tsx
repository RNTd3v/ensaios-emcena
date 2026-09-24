import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock, Music, NotebookPen, Pause, Play, RotateCcw, Square, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToCena } from '@/services/firebase/cenas'
import {
  confirmarPresenca,
  removerPresenca,
  salvarRegistroEnsaio,
  subscribeToEnsaiosDaCena,
  updateEnsaioAnotacoes,
} from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import type { AppUser, Cena, Ensaio, Inscricao } from '@/types'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatDuracao, formatHoraCompacta } from '@/lib/cenaHorario'
import { cn } from '@/lib/utils'

export function EnsaioAoVivo() {
  const { id: cenaId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const [cena, setCena] = useState<Cena | null | undefined>(undefined)
  const [ensaios, setEnsaios] = useState<Ensaio[] | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})

  useEffect(() => {
    if (!cenaId) return
    return subscribeToCena(cenaId, setCena)
  }, [cenaId])

  useEffect(() => {
    if (!cenaId) return
    return subscribeToEnsaiosDaCena(cenaId, setEnsaios)
  }, [cenaId])

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const inscricoesByUid = useMemo(() => Object.fromEntries((inscricoes ?? []).map(i => [i.uid, i])), [inscricoes])
  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  const todayKey = toDateKey(new Date())
  const ensaioHoje = useMemo(
    () => (ensaios ?? []).find(e => e.data === todayKey && !e.canceledByUid),
    [ensaios, todayKey],
  )
  const proximoEnsaio = useMemo(() => {
    if (!ensaios) return undefined
    return ensaios
      .filter(e => !e.canceledByUid && e.data > todayKey)
      .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))[0]
  }, [ensaios, todayKey])

  const canManageAgenda = !!cena && !!currentUser && (currentUser.role === 'admin' || cena.liderUid === currentUser.uid)

  const elenco = useMemo(() => (cena?.personagens ?? []).filter(p => p.participanteUid), [cena?.personagens])

  // ---------- Cronômetro ----------
  const [segundos, setSegundos] = useState(0)
  const [rodando, setRodando] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!rodando) return
    intervalRef.current = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [rodando])

  // ---------- Anotações (autosave) ----------
  const [anotacoes, setAnotacoes] = useState('')
  const [anotacoesCarregadas, setAnotacoesCarregadas] = useState(false)
  const [salvandoAnotacoes, setSalvandoAnotacoes] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!ensaioHoje || anotacoesCarregadas) return
    setAnotacoes(ensaioHoje.anotacoes ?? '')
    setAnotacoesCarregadas(true)
  }, [ensaioHoje, anotacoesCarregadas])

  function handleAnotacoesChange(value: string) {
    setAnotacoes(value)
    if (!ensaioHoje) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      setSalvandoAnotacoes(true)
      try {
        await updateEnsaioAnotacoes(ensaioHoje.id, value)
      } finally {
        setSalvandoAnotacoes(false)
      }
    }, 800)
  }

  // ---------- Finalizar ----------
  const [finalizando, setFinalizando] = useState(false)

  async function handleFinalizar() {
    if (!ensaioHoje || !currentUser) return
    setFinalizando(true)
    try {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      await salvarRegistroEnsaio(ensaioHoje.id, { anotacoes, duracaoSegundos: segundos }, currentUser.uid)
      navigate(`/cenas/${cenaId}`)
    } finally {
      setFinalizando(false)
    }
  }

  async function togglePresenca(uid: string) {
    if (!ensaioHoje) return
    const presente = ensaioHoje.presencas?.includes(uid)
    if (presente) await removerPresenca(ensaioHoje.id, uid)
    else await confirmarPresenca(ensaioHoje.id, uid)
  }

  if (cena === undefined || !ensaios) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  if (cena === null) {
    return (
      <div className="space-y-4">
        <p className="text-white">Cena não encontrada.</p>
        <Link to="/cenas">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to={`/cenas/${cenaId}`}>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-white">{cena.nome}</h1>
          {ensaioHoje && <p className="text-xs text-white/70">Hoje · {formatHoraCompacta(ensaioHoje.horario)}</p>}
        </div>
      </div>

      {!ensaioHoje ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">Nenhum ensaio confirmado pra hoje.</p>
            {proximoEnsaio && (
              <p className="text-xs text-muted-foreground">
                Próximo: {formatRelativeDia(proximoEnsaio.data, todayKey)} · {formatHoraCompacta(proximoEnsaio.horario)}
              </p>
            )}
          </CardContent>
        </Card>
      ) : ensaioHoje.finalizadoAt ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">Esse ensaio já foi finalizado.</p>
            {ensaioHoje.duracaoSegundos !== undefined && (
              <p className="text-xs text-muted-foreground">Duração registrada: {formatDuracao(ensaioHoje.duracaoSegundos)}</p>
            )}
            <p className="text-xs text-muted-foreground">Veja o registro completo no card "Anotações" da cena.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-5">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Cronômetro
              </div>
              <p className="font-mono text-5xl font-semibold tabular-nums text-gray-900">{formatDuracao(segundos)}</p>
              <div className="flex w-full gap-2">
                <Button className="flex-1 gap-1.5" onClick={() => setRodando(v => !v)}>
                  {rodando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {rodando ? 'Pausar' : segundos > 0 ? 'Retomar' : 'Iniciar'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setRodando(false)
                    setSegundos(0)
                  }}
                  title="Zerar"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  Presença
                </p>
                <span className="text-xs text-muted-foreground">
                  {ensaioHoje.presencas?.length ?? 0}/{elenco.length}
                </span>
              </div>
              {elenco.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum personagem com participante vinculado.</p>
              ) : (
                <div className="space-y-1">
                  {elenco.map(p => {
                    const uid = p.participanteUid as string
                    const presente = !!ensaioHoje.presencas?.includes(uid)
                    const podeAlterar = canManageAgenda || uid === currentUser?.uid
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={!podeAlterar}
                        onClick={() => togglePresenca(uid)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm disabled:cursor-default',
                          presente ? 'bg-emerald-50' : 'hover:bg-gray-50',
                        )}
                      >
                        <Avatar photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-8 w-8 shrink-0 text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">{nameFor(uid)}</p>
                        </div>
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                            presente ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300',
                          )}
                        >
                          {presente && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {!!cena.musicas?.length && (
            <Card>
              <CardContent className="space-y-2.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Music className="h-4 w-4 text-primary" />
                  Músicas
                </p>
                <div className="space-y-2.5">
                  {cena.musicas.map(m => (
                    <div key={m.id} className="space-y-1">
                      <p className="truncate text-sm font-medium">{m.nome}</p>
                      <audio controls src={m.url} className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ensaio-anotacoes" className="flex items-center gap-1.5">
                  <NotebookPen className="h-4 w-4 text-primary" />
                  Anotações
                </Label>
                {salvandoAnotacoes && <span className="text-[11px] text-muted-foreground">salvando...</span>}
              </div>
              <Textarea
                id="ensaio-anotacoes"
                value={anotacoes}
                onChange={e => handleAnotacoesChange(e.target.value)}
                placeholder="Ex.: revisar a coreografia do duelo, testar troca de figurino..."
              />
            </CardContent>
          </Card>

          {canManageAgenda && (
            <Button className="w-full gap-1.5" onClick={handleFinalizar} disabled={finalizando}>
              {finalizando ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Square className="h-4 w-4" />}
              Finalizar ensaio
            </Button>
          )}
        </>
      )}
    </div>
  )
}
