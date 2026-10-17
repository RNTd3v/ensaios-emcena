import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, Clock, ExternalLink, Info, Plus, MapPin, MessageCircle, NotebookPen, Pause, Pencil, Play, RotateCcw, Shirt, SlidersHorizontal, Star, Users, X, XCircle, RefreshCw } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { NotificarElenco } from '@/components/ensaio/NotificarElenco'
import { PreparoCampos, PreparoInfo, type Preparo } from '@/components/ensaio/PreparoEnsaio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToCena } from '@/services/firebase/cenas'
import {
  aplicarIndisponibilidades,
  cancelarEnsaio,
  confirmarPresenca,
  createEnsaio,
  reconfirmarEnsaio,
  removerPresenca,
  salvarRegistroEnsaio,
  subscribeToEnsaiosDaCena,
  updateEnsaioAnotacoes,
  updateEnsaioCronometro,
  migrarAusenciasLegadas,
  subscribeToAusencias,
  subscribeToRessalvas,
  subscribeToMinhaAusencia,
  uidsAusentes,
  uidsIndisponiveis,
  updateEnsaioInfo,
  type EnsaioInfo,
} from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { mapsLink, subscribeToLocais } from '@/services/firebase/locais'
import { localIcon } from '@/lib/localIcons'
import type { AppUser, AusenciaMotivo, Cena, CronometroEnsaio, Ensaio, Inscricao, LocalEnsaio, Personagem, RessalvaPresenca } from '@/types'
import { DIA_TO_WEEKDAY, formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatDuracao, formatHoraCompacta, horarioDoDia } from '@/lib/cenaHorario'
import { DIAS_ORDER } from '@/lib/dias'
import { cn } from '@/lib/utils'
import { formatDateTime, whatsappLink } from '@/lib/formatters'
import { CRONOMETRO_ZERADO, segundosDoCronometro } from '@/lib/cronometro'
import { elencoDoEnsaio } from '@/lib/ensaioPublico'
import { ensaioStatus } from '@/lib/ensaioStatus'
import { EnsaioStatusChip } from '@/components/ensaio/EnsaioStatusChip'
import { RespostaPresenca } from '@/components/ensaio/RespostaPresenca'
import { subscribeToDependentes } from '@/services/firebase/dependentes'
import { MusicasCard } from '@/components/midia/MusicasCard'
import { PessoaSelect, nomeComApelido, pessoaOpcao, type PessoaOpcao } from '@/components/ui/PessoaSelect'
import { PessoaLinha } from '@/components/ui/PessoaLinha'

/**
 * A página de um ensaio. Rotas: `/cenas/:id/ensaios/:ensaioId` (um ensaio específico),
 * `/cenas/:id/ensaios/dia/:data` (o ensaio da cena nessa data — se ainda não foi confirmado,
 * mostra o previsto pela agenda, com "Confirmar ensaio" pra admin/líder) e
 * `/cenas/:id/iniciar-ensaio` (atalho pro ensaio de hoje). O modo depende do ensaio:
 * - ao vivo: é hoje e ainda não foi finalizado — cronômetro, presença, músicas, anotações;
 * - consulta: já foi finalizado, cancelado ou a data já passou — vira o registro do ensaio;
 * - futuro: ainda não chegou o dia — mostra as infos do ensaio.
 * As infos (horário, local, flags e, na consulta, duração/anotações/presenças) aparecem só como
 * leitura; admin ou o líder da cena editam pelo lápis ao lado do nome, num modal.
 */
export function EnsaioAoVivo() {
  const { id: cenaId, ensaioId, data: dataParam } = useParams<{ id: string; ensaioId?: string; data?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useAuthStore(s => s.user)
  const { settings } = useSettingsStore()
  const checkinLimiteHoras = settings.checkinLimiteHoras ?? 2
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

  /** Quem faz o personagem: nome completo e, entre parênteses, o apelido. */
  function atorDe(uid: string) {
    return nomeComApelido(pessoaOpcao(uid, users[uid], inscricoesByUid[uid]))
  }

  const todayKey = toDateKey(new Date())
  const ensaio = useMemo(() => {
    const lista = ensaios ?? []
    if (ensaioId) return lista.find(e => e.id === ensaioId)
    if (dataParam) {
      const doDia = lista.filter(e => e.data === dataParam)
      return doDia.find(e => !e.canceledByUid) ?? doDia[0]
    }
    return lista.find(e => e.data === todayKey && !e.canceledByUid)
  }, [ensaios, ensaioId, dataParam, todayKey])
  const proximoEnsaio = useMemo(() => {
    if (!ensaios) return undefined
    return ensaios
      .filter(e => !e.canceledByUid && e.data > todayKey)
      .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))[0]
  }, [ensaios, todayKey])

  /** Admin, líder ou assistente da cena — quem cuida do dia a dia dos ensaios. */
  const canManageAgenda =
    !!cena &&
    !!currentUser &&
    (currentUser.role === 'admin' || cena.liderUid === currentUser.uid || !!cena.assistentes?.includes(currentUser.uid))

  const elenco = useMemo(() => (cena?.personagens ?? []).filter(p => p.participanteUid), [cena?.personagens])
  /** Quem é chamado pra esse ensaio: com obrigatórios marcados, só eles (ver `elencoDoEnsaio`). */
  const elencoChamado = useMemo(() => elencoDoEnsaio(cena?.personagens ?? [], ensaio?.obrigatorios), [cena?.personagens, ensaio?.obrigatorios])

  // Motivos de ausência gravados no formato antigo (no próprio ensaio, legíveis por todo o elenco)
  // vão pra subcoleção privada assim que admin/líder abre a página.
  const temAusenciasLegadas = !!ensaio && Object.keys(ensaio.ausencias ?? {}).length > 0
  useEffect(() => {
    if (!canManageAgenda || !ensaio || !temAusenciasLegadas) return
    migrarAusenciasLegadas(ensaio).catch(() => {})
  }, [canManageAgenda, ensaio, temAusenciasLegadas])

  /** Qualquer inscrito com acesso ativo — pra marcar presença de quem foi sem ser do elenco da cena. */
  const pessoas = useMemo(
    () =>
      (inscricoes ?? [])
        .filter(i => i.status === 'confirmado' && users[i.uid]?.active !== false)
        .map(i => pessoaOpcao(i.uid, users[i.uid], i))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [inscricoes, users],
  )

  const modo: 'aoVivo' | 'consulta' | 'futuro' | null = !ensaio
    ? null
    : ensaio.finalizadoAt || ensaio.data < todayKey || ensaio.canceledByUid
      ? 'consulta'
      : ensaio.data === todayKey
        ? 'aoVivo'
        : 'futuro'

  // ---------- Cronômetro ----------
  // Conta pelo relógio (início + acumulado), não por tiques: com a tela apagada o celular congela
  // a página e o setInterval para. Fica no próprio ensaio, então aparece igual em todos os aparelhos
  // e sobrevive se o sistema descartar a aba.
  const cronometro = ensaio?.cronometro ?? CRONOMETRO_ZERADO
  const [, setTique] = useState(0)
  const rodando = cronometro.inicioMs !== null
  const segundos = segundosDoCronometro(cronometro)

  useEffect(() => {
    if (!rodando) return
    const atualizar = () => setTique(t => t + 1)
    const interval = setInterval(atualizar, 1000)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [rodando])

  function mudarCronometro(novo: CronometroEnsaio) {
    if (ensaio) updateEnsaioCronometro(ensaio.id, novo).catch(() => {})
  }

  function alternarCronometro() {
    mudarCronometro(
      rodando
        ? { acumuladoSeg: segundos, inicioMs: null }
        : { acumuladoSeg: cronometro.acumuladoSeg, inicioMs: Date.now() },
    )
  }

  // ---------- Anotações ao vivo (autosave) ----------
  const [anotacoes, setAnotacoes] = useState('')
  const [anotacoesCarregadasDe, setAnotacoesCarregadasDe] = useState<string | null>(null)
  const [salvandoAnotacoes, setSalvandoAnotacoes] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!ensaio || anotacoesCarregadasDe === ensaio.id) return
    setAnotacoes(ensaio.anotacoes ?? '')
    setAnotacoesCarregadasDe(ensaio.id)
  }, [ensaio, anotacoesCarregadasDe])

  function handleAnotacoesChange(value: string) {
    setAnotacoes(value)
    if (!ensaio) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      setSalvandoAnotacoes(true)
      try {
        await updateEnsaioAnotacoes(ensaio.id, value)
      } finally {
        setSalvandoAnotacoes(false)
      }
    }, 800)
  }

  const [editOpen, setEditOpen] = useState(false)

  // ---------- Ensaio ainda não confirmado (rota por data) ----------
  const diaDaData = dataParam
    ? DIAS_ORDER.find(d => DIA_TO_WEEKDAY[d] === new Date(`${dataParam}T00:00:00`).getDay())
    : undefined
  const horarioPrevisto = (cena && diaDaData && horarioDoDia(cena, diaDaData)) || cena?.horario || ''
  // Confirmar (data sem ensaio) e reconfirmar (ensaio cancelado) abrem o mesmo modal da edição.
  const [confirmarOpen, setConfirmarOpen] = useState(false)

  async function handleConfirmarEnsaio(info: EnsaioInfo) {
    if (!cena || !currentUser || !dataParam) return
    const { obrigatorios, ...flags } = info
    const novoId = await createEnsaio(cena.id, dataParam, info.horario, currentUser.uid, obrigatorios, flags)
    await aplicarIndisponibilidades(novoId, uidsIndisponiveis(cena, dataParam, inscricoesByUid, undefined, obrigatorios)).catch(() => {})
    navigate(`/cenas/${cena.id}/ensaios/${novoId}`, { replace: true })
  }

  // ---------- Finalizar ----------
  const [finalizando, setFinalizando] = useState(false)

  /** Grava o registro e fica na página, que passa pro modo consulta (pela rota do próprio ensaio). */
  async function handleFinalizar() {
    if (!ensaio || !currentUser) return
    setFinalizando(true)
    try {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      await salvarRegistroEnsaio(ensaio.id, { anotacoes, duracaoSegundos: segundos }, currentUser.uid)
      if (!ensaioId) navigate(`/cenas/${cenaId}/ensaios/${ensaio.id}`, { replace: true })
    } finally {
      setFinalizando(false)
    }
  }

  async function handleReconfirmar(info: EnsaioInfo) {
    if (!ensaio || !currentUser) return
    await reconfirmarEnsaio(ensaio.id, currentUser.uid, info)
    if (cena) await aplicarIndisponibilidades(ensaio.id, uidsIndisponiveis(cena, ensaio.data, inscricoesByUid, undefined, info.obrigatorios)).catch(() => {})
  }

  /** Voltar leva pra tela anterior; se a página foi aberta direto (sem histórico no app), pra cena. */
  function handleVoltar() {
    if (location.key !== 'default') navigate(-1)
    else navigate(`/cenas/${cenaId}`)
  }

  async function togglePresenca(uid: string) {
    if (!ensaio) return
    const presente = ensaio.presencas?.includes(uid)
    if (presente) await removerPresenca(ensaio.id, uid)
    else await confirmarPresenca(ensaio.id, uid)
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

  // Menor de idade sem telefone próprio: fala com o responsável.
  const telefoneDe = (uid: string) => inscricoesByUid[uid]?.telefone || inscricoesByUid[uid]?.responsavel?.telefone || undefined
  const presencaProps = { elenco: elencoChamado, users, nameFor, onToggle: togglePresenca, podeVerMotivo: canManageAgenda, telefoneDe, atorDe }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleVoltar} title="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h1 className="min-w-0 truncate text-xl font-semibold text-white">
              <Link to={`/cenas/${cena.id}`} className="hover:underline" title="Abrir a cena">
                {cena.nome}
              </Link>
            </h1>
            {canManageAgenda && ensaio && !ensaio.canceledByUid && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-white hover:bg-white/10"
                onClick={() => setEditOpen(true)}
                title="Editar ensaio"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          {ensaio ? (
            <p className="text-xs text-white/70">
              {formatRelativeDia(ensaio.data, todayKey)} · {formatHoraCompacta(ensaio.horario)}
            </p>
          ) : (
            dataParam && (
              <p className="text-xs text-white/70">
                {formatRelativeDia(dataParam, todayKey)}
                {horarioPrevisto && ` · ${formatHoraCompacta(horarioPrevisto)}`}
              </p>
            )
          )}
        </div>
      </div>

      {!ensaio && dataParam ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-semibold">
                {new Date(`${dataParam}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                {horarioPrevisto && ` · ${formatHoraCompacta(horarioPrevisto)}`}
              </p>
              <EnsaioStatusChip status="naoConfirmado" className="mt-0.5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {diaDaData && cena.dias.includes(diaDaData)
                ? 'Esse dia está na agenda da cena, mas o ensaio ainda não foi confirmado.'
                : 'Não há ensaio dessa cena nessa data.'}
            </p>
            {canManageAgenda && dataParam >= todayKey && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-gray-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>
                  Clique em <span className="font-semibold">Configurar ensaio</span> pra definir horário, local e personagens obrigatórios.
                  O elenco só é avisado quando você confirmar — e, se marcar obrigatórios, só quem faz esses personagens.
                </p>
              </div>
            )}
            {canManageAgenda && dataParam >= todayKey && (
              <Button className="w-full gap-1.5" onClick={() => setConfirmarOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" />
                Configurar ensaio
              </Button>
            )}
          </CardContent>
        </Card>
      ) : !ensaio ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              {ensaioId ? 'Ensaio não encontrado.' : 'Nenhum ensaio confirmado pra hoje.'}
            </p>
            {!ensaioId && proximoEnsaio && (
              <p className="text-xs text-muted-foreground">
                Próximo: {formatRelativeDia(proximoEnsaio.data, todayKey)} · {formatHoraCompacta(proximoEnsaio.horario)}
              </p>
            )}
          </CardContent>
        </Card>
      ) : modo === 'consulta' ? (
        <>
          <RegistroEnsaio ensaio={ensaio} nameFor={nameFor} users={users} />
          {!ensaio.canceledByUid && <PresencaCard {...presencaProps} ensaio={ensaio} podeAlterar={() => false} />}
          {ensaio.canceledByUid && canManageAgenda && ensaio.data >= todayKey && (
            <Button className="w-full gap-1.5" onClick={() => setConfirmarOpen(true)}>
              <RefreshCw className="h-4 w-4" />
              Reconfirmar ensaio
            </Button>
          )}
        </>
      ) : (
        <>
          <InfoEnsaio ensaio={ensaio} />
          <LocalCard ensaio={ensaio} />

          {modo === 'futuro' ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                O cronômetro e o registro ficam disponíveis no dia do ensaio.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-3">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Cronômetro
                </div>
                <p className="font-mono text-4xl font-semibold tabular-nums text-gray-900">{formatDuracao(segundos)}</p>
                <div className="flex w-full gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={alternarCronometro}>
                    {rodando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {rodando ? 'Pausar' : segundos > 0 ? 'Retomar' : 'Iniciar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => mudarCronometro(CRONOMETRO_ZERADO)}
                    title="Zerar"
                    className="h-10 w-10"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <MusicasCard cena={cena} ensaio={{ id: ensaio.id, data: ensaio.data }} />

          <CheckinCard ensaio={ensaio} elenco={elencoChamado} checkinLimiteHoras={checkinLimiteHoras} />

          <PresencaCard
            {...presencaProps}
            ensaio={ensaio}
            podeAlterar={uid => modo === 'aoVivo' && (canManageAgenda || uid === currentUser?.uid)}
          />

          {modo === 'aoVivo' && (
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
          )}

          {modo === 'aoVivo' && canManageAgenda && (
            <Button className="w-full gap-1.5" onClick={handleFinalizar} disabled={finalizando}>
              {finalizando ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <CheckCircle2 className="h-4 w-4" />}
              Finalizar ensaio
            </Button>
          )}
        </>
      )}

      {/* Rodapé discreto: quem confirmou (ou reconfirmou) e quando — e, se cancelado, quando. */}
      {ensaio && (
        <p className="text-center text-[11px] text-white/50">
          Confirmado por {nameFor(ensaio.confirmedByUid)} em {formatDateTime(ensaio.confirmedAt)}
          {ensaio.canceledByUid && ensaio.canceledAt && ` · cancelado em ${formatDateTime(ensaio.canceledAt)}`}
        </p>
      )}

      {canManageAgenda && ((!ensaio && dataParam) || ensaio?.canceledByUid) && (
        <EditarEnsaioDialog
          key={`confirmar-${ensaio?.id ?? dataParam}-${confirmarOpen}`}
          open={confirmarOpen}
          onClose={() => setConfirmarOpen(false)}
          ensaio={ensaio}
          horarioInicial={ensaio ? undefined : horarioPrevisto}
          onConfirmar={ensaio ? handleReconfirmar : handleConfirmarEnsaio}
          comRegistro={false}
          personagens={cena.personagens}
          elenco={elenco}
          pessoas={pessoas}
          nameFor={nameFor}
          atorDe={atorDe}
        />
      )}

      {ensaio && canManageAgenda && (
        <EditarEnsaioDialog
          key={`${ensaio.id}-${editOpen}`}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          ensaio={ensaio}
          comRegistro={modo === 'consulta'}
          personagens={cena.personagens}
          elenco={elenco}
          pessoas={pessoas}
          nameFor={nameFor}
          atorDe={atorDe}
        />
      )}
    </div>
  )
}

/** Data por extenso + status + flags (geral / com figurino) do ensaio. */
function InfoEnsaio({ ensaio }: { ensaio: Ensaio }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold">
            {new Date(`${ensaio.data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {' · '}
            {formatHoraCompacta(ensaio.horario)}
          </p>
          <EnsaioStatusChip status={ensaioStatus(ensaio, toDateKey(new Date()))} className="mt-0.5" />
        </div>
        <PreparoInfo roupa={ensaio.roupa} levar={ensaio.levar} />
        {(ensaio.geral || ensaio.comFigurino) && (
          <div className="flex flex-wrap gap-1.5">
            {ensaio.geral && (
              <Badge variant="outline" className="gap-1.5 text-xs">
                <Star className="h-3.5 w-3.5" />
                Ensaio geral
              </Badge>
            )}
            {ensaio.comFigurino && (
              <Badge variant="outline" className="gap-1.5 text-xs">
                <Shirt className="h-3.5 w-3.5" />
                Com figurino
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Locais de ensaio cadastrados pelo admin, em tempo real. */
function useLocais(): LocalEnsaio[] {
  const [locais, setLocais] = useState<LocalEnsaio[]>([])
  useEffect(() => subscribeToLocais(setLocais), [])
  return locais
}

function findLocal(locais: LocalEnsaio[], nome: string | undefined) {
  const key = nome?.trim().toLowerCase()
  return key ? locais.find(l => l.nome.trim().toLowerCase() === key) : undefined
}

/**
 * Local do ensaio (só leitura — edição pelo modal). Se o nome bate com um local cadastrado,
 * mostra também endereço e observação — e o link pro mapa, só quando o local tem endereço.
 */
function LocalCard({ ensaio }: { ensaio: Ensaio }) {
  const locais = useLocais()
  const cadastrado = findLocal(locais, ensaio.local)
  const Icon = cadastrado ? localIcon(cadastrado.icone) : MapPin
  return (
    <Card>
      <CardContent className="flex items-start gap-1.5 text-sm">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        {!ensaio.local ? (
          <span className="text-muted-foreground">Local não definido</span>
        ) : (
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium text-gray-700">{ensaio.local}</p>
            {cadastrado?.endereco && <p className="text-xs text-gray-500">{cadastrado.endereco}</p>}
            {cadastrado?.observacao && <p className="whitespace-pre-wrap text-xs text-gray-500">{cadastrado.observacao}</p>}
            {cadastrado?.endereco && (
              <a
                href={mapsLink(cadastrado)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver no mapa
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface CheckinCardProps {
  ensaio: Ensaio
  elenco: Personagem[]
  checkinLimiteHoras: number
}

/** A resposta da própria pessoa (quem tem personagem na cena): "Vou" / "Não vou" com motivo. */
function CheckinCard({ ensaio, elenco, checkinLimiteHoras }: CheckinCardProps) {
  const currentUser = useAuthStore(s => s.user)
  // Filhos (dependentes) da pessoa: ela responde a presença por eles também.
  const [dependentes, setDependentes] = useState<Inscricao[]>([])
  useEffect(() => {
    if (!currentUser) return
    return subscribeToDependentes(currentUser.uid, setDependentes)
  }, [currentUser])
  if (!currentUser) return null

  const noElenco = (uid: string) => elenco.some(p => p.participanteUid === uid)
  const filhosNoElenco = dependentes.filter(d => noElenco(d.uid))

  return (
    <>
      {noElenco(currentUser.uid) && (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold">Sua presença</p>
            <RespostaPresenca ensaio={ensaio} uid={currentUser.uid} checkinLimiteHoras={checkinLimiteHoras} />
          </CardContent>
        </Card>
      )}
      {filhosNoElenco.map(d => (
        <Card key={d.uid}>
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold">Presença de {d.apelido || d.nomeCompleto}</p>
            <RespostaPresenca ensaio={ensaio} uid={d.uid} checkinLimiteHoras={checkinLimiteHoras} paraQuem={d.apelido || d.nomeCompleto} />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

interface PresencaCardProps {
  ensaio: Ensaio
  elenco: Personagem[]
  users: Record<string, AppUser>
  nameFor: (uid: string) => string
  onToggle: (uid: string) => void
  podeAlterar: (uid: string) => boolean
  /** Admin/líder veem o motivo de quem avisou que não vai; os demais só veem que a pessoa não vai. */
  podeVerMotivo?: boolean
  /** Telefone pra abrir o WhatsApp — só existe pra quem lê as inscrições (admin/líder). */
  telefoneDe: (uid: string) => string | undefined
  /** "Nome Completo (Apelido)" de quem faz o personagem. */
  atorDe: (uid: string) => string
}

/**
 * Motivos de ausência que quem está vendo pode ler: todos (admin/líder, `podeVerTodos`) ou só o
 * próprio. Lidos da subcoleção privada, com fallback pro legado ainda não migrado.
 */
function useMotivosAusencia(ensaio: Ensaio, podeVerTodos: boolean, currentUid: string | undefined) {
  const [todos, setTodos] = useState<Record<string, AusenciaMotivo>>({})
  const [meu, setMeu] = useState<AusenciaMotivo | null>(null)
  useEffect(() => {
    if (!podeVerTodos) return setTodos({})
    return subscribeToAusencias(ensaio.id, setTodos)
  }, [ensaio.id, podeVerTodos])
  const souAusente = !!currentUid && uidsAusentes(ensaio).includes(currentUid)
  useEffect(() => {
    if (podeVerTodos || !currentUid || !souAusente) return setMeu(null)
    return subscribeToMinhaAusencia(ensaio.id, currentUid, setMeu)
  }, [ensaio.id, podeVerTodos, currentUid, souAusente])

  return (uid: string): string | undefined => {
    const legado = ensaio.ausencias?.[uid]?.motivo
    if (podeVerTodos) return todos[uid]?.motivo ?? legado
    if (uid === currentUid) return meu?.motivo ?? legado
    return undefined
  }
}

function PresencaCard({ ensaio, elenco, users, nameFor, onToggle, podeAlterar, podeVerMotivo, telefoneDe, atorDe }: PresencaCardProps) {
  const currentUid = useAuthStore(s => s.user?.uid)
  const ausentes = uidsAusentes(ensaio)
  const motivoDe = useMotivosAusencia(ensaio, !!podeVerMotivo, currentUid)
  const [ressalvas, setRessalvas] = useState<Record<string, RessalvaPresenca>>({})
  useEffect(() => {
    if (!podeVerMotivo) return setRessalvas({})
    return subscribeToRessalvas(ensaio.id, setRessalvas)
  }, [ensaio.id, podeVerMotivo])
  const elencoUids = new Set(elenco.map(p => p.participanteUid as string))
  const presentesElenco = (ensaio.presencas ?? []).filter(uid => elencoUids.has(uid)).length
  /** Quem esteve presente sem ser do elenco da cena (adicionado pelo modal de edição). */
  const extras = (ensaio.presencas ?? []).filter(uid => !elencoUids.has(uid))
  return (
    <Card>
      <CardContent className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" />
            Presença
          </p>
          <span className="text-xs text-muted-foreground">
            {presentesElenco}/{elencoUids.size}
            {extras.length > 0 && ` + ${extras.length}`}
          </span>
        </div>
        {elenco.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum personagem com participante vinculado.</p>
        ) : (
          <div className="space-y-1">
            {elenco.map(p => {
              const uid = p.participanteUid as string
              const presente = !!ensaio.presencas?.includes(uid)
              const telefone = telefoneDe(uid)
              const pessoa = (
                <>
                  <Avatar photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-8 w-8 shrink-0 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.nome}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <span className="truncate">{atorDe(uid)}</span>
                      {telefone && <MessageCircle className="h-3 w-3 shrink-0 text-emerald-600" />}
                    </p>
                    {!presente && ausentes.includes(uid) && (
                      <p className="whitespace-pre-wrap text-xs text-red-600">
                        Não vai{motivoDe(uid) ? `: ${motivoDe(uid)}` : ''}
                      </p>
                    )}
                    {!ausentes.includes(uid) && ressalvas[uid] && (
                      <p className="whitespace-pre-wrap text-xs text-amber-700">Ressalva: {ressalvas[uid].texto}</p>
                    )}
                  </div>
                </>
              )
              const marca = (
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    presente
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : ausentes.includes(uid)
                        ? 'border-red-400 bg-red-50 text-red-500'
                        : 'border-gray-300',
                  )}
                >
                  {presente ? <Check className="h-3 w-3" /> : ausentes.includes(uid) && <X className="h-3 w-3" />}
                </span>
              )
              const fundo = presente ? 'bg-emerald-50' : 'hover:bg-gray-50'

              // Sem telefone (quem não lê as inscrições): a linha inteira marca presença, como antes.
              if (!telefone) {
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!podeAlterar(uid)}
                    onClick={() => onToggle(uid)}
                    className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm disabled:cursor-default', fundo)}
                  >
                    {pessoa}
                    {marca}
                  </button>
                )
              }

              // Com telefone: tocar na pessoa abre o WhatsApp; a bolinha marca presença.
              return (
                <div key={p.id} className={cn('flex w-full items-center gap-1 rounded-lg pl-2 text-sm', fundo)}>
                  <a
                    href={whatsappLink(telefone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left"
                  >
                    {pessoa}
                  </a>
                  <button
                    type="button"
                    disabled={!podeAlterar(uid)}
                    onClick={() => onToggle(uid)}
                    title={presente ? 'Desmarcar presença' : 'Marcar presença'}
                    className="flex h-11 w-11 shrink-0 items-center justify-center disabled:cursor-default"
                  >
                    {marca}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {extras.length > 0 && (
          <div className="border-t border-gray-100 pt-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Também presentes</p>
            <div className="space-y-1">
              {extras.map(uid => {
                const telefone = telefoneDe(uid)
                const linha = (
                  <PessoaLinha pessoa={pessoaOpcao(uid, users[uid])} className="rounded-lg bg-emerald-50 px-2 py-1.5">
                    {telefone && <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  </PessoaLinha>
                )
                return telefone ? (
                  <a key={uid} href={whatsappLink(telefone)} target="_blank" rel="noreferrer" className="block">
                    {linha}
                  </a>
                ) : (
                  <div key={uid}>{linha}</div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface RegistroEnsaioProps {
  ensaio: Ensaio
  nameFor: (uid: string) => string
  users: Record<string, AppUser>
}

/** Modo consulta: o registro de um ensaio que já aconteceu (só leitura — edição pelo modal). */
function RegistroEnsaio({ ensaio, nameFor, users }: RegistroEnsaioProps) {
  return (
    <>
      <InfoEnsaio ensaio={ensaio} />

      {ensaio.canceledByUid ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-red-50 px-3 py-2.5">
          <Avatar photoURL={users[ensaio.canceledByUid]?.photoURL} name={nameFor(ensaio.canceledByUid)} className="h-9 w-9 text-xs" />
          <div>
            <p className="flex items-center gap-1 text-sm font-medium text-red-700">
              <XCircle className="h-4 w-4" />
              Ensaio cancelado
            </p>
            <p className="text-xs text-red-600">por {nameFor(ensaio.canceledByUid)}</p>
          </div>
        </div>
      ) : (
        <>
          <LocalCard ensaio={ensaio} />

          <Card>
            <CardContent className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <NotebookPen className="h-4 w-4 text-primary" />
                Registro do ensaio
              </p>
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {ensaio.duracaoSegundos !== undefined ? formatDuracao(ensaio.duracaoSegundos) : 'Duração não registrada'}
              </p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{ensaio.anotacoes || 'Nenhuma anotação registrada.'}</p>
              {ensaio.finalizadoByUid ? (
                <p className="text-[11px] text-muted-foreground">Última atualização por {nameFor(ensaio.finalizadoByUid)}</p>
              ) : ensaio.finalizadoAuto ? (
                <p className="text-[11px] text-muted-foreground">Finalizado automaticamente no dia seguinte — ninguém finalizou pela tela ao vivo.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Esse ensaio não foi finalizado pela tela ao vivo.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

interface EditarEnsaioDialogProps {
  open: boolean
  onClose: () => void
  /** O ensaio editado — ao confirmar, o cancelado que está sendo reconfirmado (ou nenhum, se é novo). */
  ensaio?: Ensaio
  /**
   * Modo confirmação: o modal grava por aqui (criar ou reconfirmar) em vez de editar, e esconde
   * presenças e o cancelar.
   */
  onConfirmar?: (info: EnsaioInfo) => Promise<void>
  /** Horário sugerido quando não há ensaio de base (o previsto pela agenda). */
  horarioInicial?: string
  /** Ensaio já aconteceu: também edita duração, anotações e presenças. */
  comRegistro: boolean
  /** Todos os personagens da cena — pra marcar os obrigatórios. */
  personagens: Personagem[]
  elenco: Personagem[]
  pessoas: PessoaOpcao[]
  nameFor: (uid: string) => string
  atorDe: (uid: string) => string
}

/**
 * Modal de edição do ensaio (admin/líder) — o mesmo serve pra confirmar um ensaio novo ou
 * reconfirmar um cancelado (`onConfirmar`). Remontado a cada abertura (via `key`), então os
 * rascunhos sempre partem do estado atual do ensaio.
 */
function EditarEnsaioDialog({
  open,
  onClose,
  ensaio,
  onConfirmar,
  horarioInicial,
  comRegistro,
  personagens,
  elenco,
  pessoas,
  nameFor,
  atorDe,
}: EditarEnsaioDialogProps) {
  const currentUser = useAuthStore(s => s.user)
  const confirmando = !!onConfirmar
  const duracaoInicial = ensaio?.duracaoSegundos !== undefined ? String(Math.round(ensaio.duracaoSegundos / 60)) : ''
  const [horario, setHorario] = useState(horarioInicial ?? ensaio?.horario ?? '')
  const [local, setLocal] = useState(ensaio?.local ?? '')
  const locais = useLocais()
  const localCadastrado = findLocal(locais, local)
  const [geral, setGeral] = useState(!!ensaio?.geral)
  const [comFigurino, setComFigurino] = useState(!!ensaio?.comFigurino)
  const [preparo, setPreparo] = useState<Preparo>({ roupa: ensaio?.roupa ?? '', levar: ensaio?.levar ?? '' })
  const [duracao, setDuracao] = useState(duracaoInicial)
  const [anotacoes, setAnotacoes] = useState(ensaio?.anotacoes ?? '')
  const [presencas, setPresencas] = useState<string[]>(ensaio?.presencas ?? [])
  const [obrigatorios, setObrigatorios] = useState<string[]>(ensaio?.obrigatorios ?? [])
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [canceling, setCanceling] = useState(false)
  // Horário, local e obrigatórios geram aviso ("Ensaio alterado", "Você foi chamado", "Você não
  // precisa ir") — aí aparece a opção de notificar ou não.
  const [notificar, setNotificar] = useState(true)
  const obrigatoriosMudaram =
    !!ensaio && JSON.stringify([...obrigatorios].sort()) !== JSON.stringify([...(ensaio.obrigatorios ?? [])].sort())
  // Confirmar sempre avisa o elenco ("Ensaio confirmado"/"reconfirmado"), sem essa opção.
  const mudaAviso =
    !confirmando && !!ensaio && (horario !== ensaio.horario || local.trim() !== (ensaio.local ?? '').trim() || obrigatoriosMudaram)
  const [extraUid, setExtraUid] = useState('')
  // A lista de presença segue os obrigatórios do rascunho: marcou obrigatórios, só eles ficam no elenco.
  const elencoChamado = elencoDoEnsaio(elenco, obrigatorios)
  const elencoUids = new Set(elencoChamado.map(p => p.participanteUid as string))
  const extras = presencas.filter(uid => !elencoUids.has(uid))
  const disponiveisExtra = pessoas.filter(p => !elencoUids.has(p.uid) && !presencas.includes(p.uid))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function togglePresenca(uid: string) {
    setPresencas(prev => (prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]))
  }

  async function handleSave() {
    if (!currentUser) return
    if (!horario) {
      setError('Preencha o horário.')
      return
    }
    setSaving(true)
    setError('')
    if (onConfirmar) {
      try {
        await onConfirmar({ horario, local, geral, comFigurino, ...preparo, obrigatorios })
        onClose()
      } catch {
        setError('Não foi possível confirmar. Tente de novo.')
      } finally {
        setSaving(false)
      }
      return
    }
    if (!ensaio) return
    try {
      // Só regrava presenças se mudaram — ao vivo, outras pessoas podem estar fazendo check-in ao mesmo tempo.
      const presencasMudaram = JSON.stringify([...presencas].sort()) !== JSON.stringify([...(ensaio.presencas ?? [])].sort())
      await updateEnsaioInfo(
        ensaio.id,
        { horario, local, geral, comFigurino, ...preparo, obrigatorios, presencas: presencasMudaram ? presencas : undefined },
        currentUser.uid,
        notificar,
      )
      const registroMudou = duracao !== duracaoInicial || anotacoes !== (ensaio.anotacoes ?? '')
      if (comRegistro && registroMudou) {
        await salvarRegistroEnsaio(ensaio.id, { anotacoes, duracaoSegundos: (parseInt(duracao, 10) || 0) * 60 }, currentUser.uid)
      }
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelar() {
    if (!currentUser || !ensaio) return
    setCanceling(true)
    try {
      await cancelarEnsaio(ensaio.id, currentUser.uid, notificar)
      onClose()
    } catch {
      setError('Não foi possível cancelar. Tente de novo.')
      setCanceling(false)
    }
  }

  function toggleObrigatorio(personagemId: string) {
    setObrigatorios(prev => (prev.includes(personagemId) ? prev.filter(id => id !== personagemId) : [...prev, personagemId]))
  }

  const chip = (ativo: boolean) =>
    cn(
      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
      ativo ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
    )

  return (
    <Dialog open={open} onClose={onClose} title={!confirmando ? 'Editar ensaio' : ensaio ? 'Reconfirmar ensaio' : 'Confirmar ensaio'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="editar-ensaio-horario">Horário</Label>
          <Input id="editar-ensaio-horario" type="time" value={horario} onChange={e => setHorario(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="editar-ensaio-local">Local</Label>
          <Input
            id="editar-ensaio-local"
            value={local}
            onChange={e => setLocal(e.target.value)}
            placeholder={locais.length ? 'Escolha abaixo ou digite um local' : 'Ex.: Salão da igreja, sala 2'}
          />
          {locais.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {locais.map(l => {
                const Icon = localIcon(l.icone)
                const selecionado = localCadastrado?.id === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLocal(selecionado ? '' : l.nome)}
                    className={chip(selecionado)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {l.nome}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setGeral(v => !v)} className={chip(geral)}>
            <Star className="h-3.5 w-3.5" />
            Ensaio geral
          </button>
          <button type="button" onClick={() => setComFigurino(v => !v)} className={chip(comFigurino)}>
            <Shirt className="h-3.5 w-3.5" />
            Com figurino
          </button>
        </div>
        <PreparoCampos idPrefixo="editar-ensaio" value={preparo} onChange={patch => setPreparo(p => ({ ...p, ...patch }))} />

        {personagens.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Personagens obrigatórios</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setObrigatorios(personagens.every(p => obrigatorios.includes(p.id)) ? [] : personagens.map(p => p.id))}
                className={cn(chip(personagens.every(p => obrigatorios.includes(p.id))), 'font-semibold')}
              >
                Todos
              </button>
              {personagens.map(p => (
                <button key={p.id} type="button" onClick={() => toggleObrigatorio(p.id)} className={chip(obrigatorios.includes(p.id))}>
                  {p.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {comRegistro && (
          <>
            <div>
              <Label htmlFor="editar-ensaio-duracao">Duração (minutos)</Label>
              <Input
                id="editar-ensaio-duracao"
                type="number"
                min={0}
                value={duracao}
                onChange={e => setDuracao(e.target.value)}
                placeholder="Ex.: 90"
              />
            </div>
            <div>
              <Label htmlFor="editar-ensaio-anotacoes">Anotações</Label>
              <Textarea
                id="editar-ensaio-anotacoes"
                value={anotacoes}
                onChange={e => setAnotacoes(e.target.value)}
                className="mt-1.5"
                placeholder="Ex.: revisar a coreografia do duelo, testar troca de figurino..."
              />
            </div>
          </>
        )}

        {!confirmando && (
          <div>
            <p className="mb-1.5 text-sm font-medium">
              Presença ({presencas.filter(uid => elencoUids.has(uid)).length}/{elencoUids.size}
              {extras.length > 0 && ` + ${extras.length}`})
            </p>
            {elencoChamado.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum personagem com participante vinculado.</p>
            ) : (
              <div className="space-y-1">
                {elencoChamado.map(p => {
                  const uid = p.participanteUid as string
                  const presente = presencas.includes(uid)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePresenca(uid)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm',
                        presente ? 'bg-emerald-50' : 'hover:bg-gray-50',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{atorDe(uid)}</p>
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
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Também presentes (fora dos chamados pro ensaio)</p>
              {extras.length > 0 && (
                <div className="mb-2 space-y-1">
                  {extras.map(uid => (
                    <PessoaLinha
                      key={uid}
                      pessoa={pessoas.find(p => p.uid === uid) ?? { uid, nome: nameFor(uid) }}
                      className="rounded-lg bg-emerald-50 px-2 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => togglePresenca(uid)}
                        title="Remover"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </PessoaLinha>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="flex-1">
                  <PessoaSelect
                    value={extraUid}
                    onChange={setExtraUid}
                    pessoas={disponiveisExtra}
                    placeholder="Adicionar pessoa..."
                    titulo="Adicionar ao ensaio"
                  />
                </div>
                <Button
                  size="icon"
                  title="Adicionar"
                  disabled={!extraUid}
                  onClick={() => {
                    togglePresenca(extraUid)
                    setExtraUid('')
                  }}
                  className="shrink-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {mudaAviso && !confirmCancel && <NotificarElenco value={notificar} onChange={setNotificar} />}

        <Button className="w-full gap-1.5" onClick={handleSave} disabled={saving || (confirmando && !horario)}>
          {saving ? <Spinner size="sm" className="border-white/40 border-t-white" /> : confirmando && <Check className="h-4 w-4" />}
          {!confirmando ? 'Salvar' : ensaio ? 'Reconfirmar ensaio' : 'Confirmar ensaio'}
        </Button>

        {confirmando ? null : confirmCancel ? (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">
              Cancelar esse ensaio? O registro continua visível como cancelado e pode ser reconfirmado depois (as presenças são zeradas).
            </p>
            <NotificarElenco value={notificar} onChange={setNotificar} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmCancel(false)} disabled={canceling}>
                Voltar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleCancelar} disabled={canceling}>
                {canceling && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Cancelar ensaio
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmCancel(true)} disabled={saving}>
            <XCircle className="h-4 w-4" />
            Cancelar ensaio
          </Button>
        )}
      </div>
    </Dialog>
  )
}
