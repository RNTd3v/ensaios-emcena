import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  Info,
  HandHelping,
  NotebookPen,
  Pencil,
  Pin,
  Play,
  Plus,
  Shirt,
  Star,
  Trash2,
  CalendarX,
  Timer,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarStack } from '@/components/ui/AvatarStack'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotificarElenco } from '@/components/ensaio/NotificarElenco'
import { RoteiroCenaCard } from '@/components/cena/RoteiroCenaCard'
import { PreparoCampos } from '@/components/ensaio/PreparoEnsaio'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers, updateUserRole } from '@/services/firebase/auth'
import {
  subscribeToCena,
  subscribeToCenas,
  updateCenaAgenda,
  updateCenaAssistentes,
  updateCenaLider,
  updateCenaNome,
  updateCenaParticipantes,
  updateCenaPersonagens,
  updateCenaRoteiro,
} from '@/services/firebase/cenas'
import { preservarPersonagensNoCatalogo } from '@/services/firebase/personagens'
import {
  aplicarIndisponibilidades,
  cancelarEnsaio,
  confirmarPresenca,
  createEnsaio,
  reconfirmarEnsaio,
  subscribeToEnsaiosDaCena,
  updateEnsaioFlags,
  updateEnsaioPreparo,
  updateEnsaioHorario,
  updateEnsaioObrigatorios,
  uidsAusentes,
  uidsIndisponiveis,
} from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import { MusicasCard } from '@/components/midia/MusicasCard'
import { FigurinosCard } from '@/components/midia/FigurinosCard'
import { AprovacoesFigurinoCard } from '@/components/midia/AprovacoesFigurinoCard'
import { ReferenciasEquipeCard } from '@/components/equipe/ReferenciasEquipeCard'
import { useMigrarMidiasLegadas } from '@/hooks/useMigrarMidiasLegadas'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  DIA_SEMANA_LABELS,
  type AppUser,
  type Cena,
  type DiaSemana,
  type Ensaio,
  type Inscricao,
  type Personagem,
} from '@/types'
import { DIAS_ORDER, diasDisponiveis, sortDias } from '@/lib/dias'
import { formatDuracao, formatTempoTotal, formatHoraCompacta, horarioDoDia } from '@/lib/cenaHorario'
import { addDays, canCheckin, DIA_TO_WEEKDAY, formatRelativeDia, toDateKey, weekDates } from '@/lib/agenda'
import { cn } from '@/lib/utils'
import { PessoaSelect, pessoaOpcao } from '@/components/ui/PessoaSelect'
import { ContatoPessoaDialog } from '@/components/cena/ContatoPessoaDialog'
import { PessoaLinha } from '@/components/ui/PessoaLinha'

interface Occurrence {
  dateKey: string
  date: Date
  dia: DiaSemana
  horario: string
}

interface ConfirmDetail {
  horario: string
  geral: boolean
  comFigurino: boolean
  roupa: string
  levar: string
  obrigatorios: string[]
}

function occurrencesForWeek(cena: Cena, base: Date): Occurrence[] {
  const result: Occurrence[] = []
  for (const date of weekDates(base)) {
    const dia = (Object.keys(DIA_TO_WEEKDAY) as DiaSemana[]).find(d => DIA_TO_WEEKDAY[d] === date.getDay())
    if (!dia || !cena.dias.includes(dia)) continue
    const dateKey = toDateKey(date)
    if (cena.inicioEnsaios && dateKey < cena.inicioEnsaios) continue
    const horario = cena.horarios?.[dia] ?? cena.horario
    if (!horario) continue
    result.push({ dateKey, date, dia, horario })
  }
  return result
}

function isCanceled(ensaio?: Ensaio): boolean {
  return !!ensaio?.canceledByUid
}

export function CenaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role === 'admin'
  const { settings } = useSettingsStore()
  const checkinLimiteHoras = settings.checkinLimiteHoras ?? 2
  const [cena, setCena] = useState<Cena | null | undefined>(undefined)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [ensaios, setEnsaios] = useState<Ensaio[] | null>(null)
  const [todasCenas, setTodasCenas] = useState<Cena[] | null>(null)

  const isLiderDaCena = !!cena && !!currentUser && cena.liderUid === currentUser.uid
  const isAssistenteDaCena = !!cena && !!currentUser && !!cena.assistentes?.includes(currentUser.uid)
  /** Estrutura da cena (agenda recorrente, grupo, assistentes): admin e líder. */
  const canManageCena = isAdmin || isLiderDaCena
  /** Dia a dia dos ensaios (confirmar, abrir, presença...): também os assistentes. Eles também
   * tiram pessoas do grupo (menos o líder e outros assistentes — firestore.rules reforça). */
  const canManageAgenda = canManageCena || isAssistenteDaCena

  const [editModalOpen, setEditModalOpen] = useState(false)
  /** Pessoa do grupo com o modal de contato aberto (líder, assistente ou participante). */
  const [pessoaModal, setPessoaModal] = useState<string | null>(null)
  const [nomeDraft, setNomeDraft] = useState('')
  const [liderUidDraft, setLiderUidDraft] = useState('')
  const [roteiroReferenciaDraft, setRoteiroReferenciaDraft] = useState('')
  const [roteiroUrlDraft, setRoteiroUrlDraft] = useState('')
  const [editPersonagensRecorrentesSelecionados, setEditPersonagensRecorrentesSelecionados] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [agendaOpen, setAgendaOpen] = useState(true)
  const [personagensOpen, setPersonagensOpen] = useState(false)
  const [personagemModalOpen, setPersonagemModalOpen] = useState(false)
  const [editingPersonagemId, setEditingPersonagemId] = useState<string | null>(null)
  const [personagemModo, setPersonagemModo] = useState<'novo' | 'existente'>('novo')
  const [personagemNomeDraft, setPersonagemNomeDraft] = useState('')
  const [personagemParticipanteDraft, setPersonagemParticipanteDraft] = useState('')
  const [personagemRecorrenteDraft, setPersonagemRecorrenteDraft] = useState(false)
  const [personagemOrigemKey, setPersonagemOrigemKey] = useState('')
  const [personagensBase, setPersonagensBase] = useState<Personagem[]>([])
  const [savingPersonagem, setSavingPersonagem] = useState(false)
  const [personagemError, setPersonagemError] = useState('')

  const [participantesOpen, setParticipantesOpen] = useState(false)
  const [participanteModalOpen, setParticipanteModalOpen] = useState(false)
  const [participanteAddUid, setParticipanteAddUid] = useState('')
  const [savingParticipante, setSavingParticipante] = useState(false)
  const [participanteError, setParticipanteError] = useState('')
  const personagemNomeInputRef = useRef<HTMLInputElement>(null)

  const [anotacoesOpen, setAnotacoesOpen] = useState(false)



  const [weekBase, setWeekBase] = useState(() => new Date())
  // Ensaios que ainda vão começar: a agenda abre na semana do início (não na atual, que fica vazia).
  // Vale ao carregar a cena e quando o início muda; depois as setas navegam livremente.
  const inicioFuturo = cena?.inicioEnsaios && cena.inicioEnsaios > toDateKey(new Date()) ? cena.inicioEnsaios : undefined
  const chaveInicio = cena ? `${cena.id}|${inicioFuturo ?? ''}` : ''
  const [chaveInicioAplicada, setChaveInicioAplicada] = useState('')
  if (chaveInicio !== chaveInicioAplicada) {
    setChaveInicioAplicada(chaveInicio)
    if (inicioFuturo) setWeekBase(new Date(`${inicioFuturo}T00:00:00`))
  }

  const [agendaModalOpen, setAgendaModalOpen] = useState(false)
  const [agendaDiasDraft, setAgendaDiasDraft] = useState<DiaSemana[]>([])
  const [agendaHorarioMode, setAgendaHorarioMode] = useState<'comum' | 'porDia'>('comum')
  const [agendaHorarioDraft, setAgendaHorarioDraft] = useState('')
  const [agendaHorariosPorDiaDraft, setAgendaHorariosPorDiaDraft] = useState<Partial<Record<DiaSemana, string>>>({})
  const [agendaInicioDraft, setAgendaInicioDraft] = useState('')
  const [savingAgenda, setSavingAgenda] = useState(false)
  const [agendaError, setAgendaError] = useState('')

  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmSelections, setConfirmSelections] = useState<Record<string, boolean>>({})
  const [confirmDetails, setConfirmDetails] = useState<Record<string, ConfirmDetail>>({})
  const [savingConfirm, setSavingConfirm] = useState(false)
  const [confirmingPresenca, setConfirmingPresenca] = useState(false)


  useEffect(() => {
    if (!id) return
    return subscribeToCena(id, setCena)
  }, [id])

  // Admin abrindo a cena: músicas/figurinos do formato antigo vão pras coleções próprias.
  useMigrarMidiasLegadas(cena ? [cena] : null)

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, setTodasCenas)
  }, [currentUser])

  useEffect(() => {
    if (!cena) return
    return subscribeToEnsaiosDaCena(cena.id, setEnsaios)
  }, [cena?.id])

  const inscricoesByUid = Object.fromEntries((inscricoes ?? []).map(i => [i.uid, i]))

  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  const participantesOpcoes = (cena?.participantes ?? []).map(uid => pessoaOpcao(uid, users[uid], inscricoesByUid[uid]))

  const ensaiosByDate = useMemo(() => Object.fromEntries((ensaios ?? []).map(e => [e.data, e])), [ensaios])
  const todayKey = toDateKey(new Date())
  const todayHasEnsaio = !!ensaiosByDate[todayKey]
  const temEnsaioHoje = todayHasEnsaio && !isCanceled(ensaiosByDate[todayKey])
  const todayDia = (Object.keys(DIA_TO_WEEKDAY) as DiaSemana[]).find(d => DIA_TO_WEEKDAY[d] === new Date().getDay())

  // Participante sem ensaio confirmado nesta semana: a agenda começa fechada (não tem o que ver).
  // Decide uma vez só, quando os ensaios chegam — depois quem manda é o toque no card.
  const agendaDecidida = useRef(false)
  useEffect(() => {
    if (agendaDecidida.current || !ensaios || !cena) return
    agendaDecidida.current = true
    if (canManageAgenda) return
    const semana = new Set(weekDates(new Date()).map(toDateKey))
    if (!ensaios.some(e => semana.has(e.data) && !isCanceled(e))) setAgendaOpen(false)
  }, [ensaios, cena, canManageAgenda])

  const proximosEnsaios = useMemo(() => {
    return (ensaios ?? [])
      .filter(e => !isCanceled(e) && (e.data > todayKey || (e.data === todayKey && e.horario >= new Date().toTimeString().slice(0, 5))))
      .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))
      .slice(0, 3)
  }, [ensaios, todayKey])
  const myPersonagem = cena?.personagens.find(p => p.participanteUid === currentUser?.uid)

  /** Segunda a sábado — domingo não tem ensaio, não faz sentido mostrar a linha na agenda. */
  const displayedWeek = useMemo(() => weekDates(weekBase).filter(d => d.getDay() !== 0), [weekBase])
  const weekLabel = (() => {
    const [start, end] = [displayedWeek[0], displayedWeek[displayedWeek.length - 1]]
    const sameMonth = start.getMonth() === end.getMonth()
    const startLabel = start.toLocaleDateString('pt-BR', { day: '2-digit', month: sameMonth ? undefined : 'short' })
    const endLabel = end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    return `${startLabel} – ${endLabel}`
  })()

  const weekOccurrences = useMemo(() => (cena ? occurrencesForWeek(cena, weekBase) : []), [cena, weekBase])
  const weekOccurrencesByDate = useMemo(() => Object.fromEntries(weekOccurrences.map(o => [o.dateKey, o])), [weekOccurrences])

  /** Grupo sem o líder (que vem à parte, no topo): assistentes primeiro, depois os demais. */
  const outrosParticipantes = useMemo(() => {
    if (!cena) return []
    const assistentes = cena.assistentes ?? []
    return cena.participantes
      .filter(uid => uid !== cena.liderUid)
      .sort((a, b) => Number(!assistentes.includes(a)) - Number(!assistentes.includes(b)))
  }, [cena])

  /** Ensaios finalizados pela tela "Iniciar ensaio" — os registros exibidos no card Anotações. */
  const registros = useMemo(
    () => (ensaios ?? []).filter(e => e.finalizadoAt).sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario)),
    [ensaios],
  )

  /** Soma do tempo cronometrado dos ensaios encerrados (os que têm duração registrada). */
  const tempoDeEnsaio = useMemo(() => {
    const comDuracao = registros.filter(e => !e.canceledByUid && (e.duracaoSegundos ?? 0) > 0)
    const total = comDuracao.reduce((soma, e) => soma + (e.duracaoSegundos ?? 0), 0)
    return { total, ensaios: comDuracao.length, media: comDuracao.length ? total / comDuracao.length : 0 }
  }, [registros])

  /** Ordem da lista: o(s) personagem(ns) de quem está vendo, depois o do líder, depois os recorrentes. */
  const personagensOrdenados = useMemo(() => {
    const peso = (p: Personagem) =>
      p.participanteUid && p.participanteUid === currentUser?.uid ? 0 : p.participanteUid && p.participanteUid === cena?.liderUid ? 1 : p.recorrente ? 2 : 3
    return [...(cena?.personagens ?? [])].sort((a, b) => peso(a) - peso(b))
  }, [cena?.personagens, cena?.liderUid, currentUser?.uid])

  const availableParaAdicionar = useMemo(
    () =>
      (inscricoes ?? [])
        .filter(i => i.status === 'confirmado' && users[i.uid]?.active !== false)
        .filter(i => !cena?.participantes.includes(i.uid))
        .filter(i => i.areas.some(a => a === 'elenco' || a === 'tecnica'))
        .filter(i => !cena?.dias.length || cena.dias.every(d => diasDisponiveis(i.disponibilidade.dias).includes(d)))
        .sort((a, b) => (a.apelido || a.nomeCompleto).localeCompare(b.apelido || b.nomeCompleto)),
    [inscricoes, users, cena?.participantes, cena?.dias],
  )

  /**
   * Personagens marcados como recorrentes em outras cenas — pra reaproveitar em vez de recadastrar
   * do zero. Deduplicado por nome: a mesma personagem recorrente em várias cenas aparece uma única vez.
   */
  const personagensRecorrentes = useMemo(() => {
    if (!cena) return []
    const nomesJaNaCena = new Set(cena.personagens.map(p => p.nome.trim().toLowerCase()))
    const porNome = new Map<string, { nome: string; participanteUid?: string }>()
    for (const c of todasCenas ?? []) {
      if (c.id === cena.id) continue
      for (const p of c.personagens) {
        if (!p.recorrente) continue
        const key = p.nome.trim().toLowerCase()
        if (nomesJaNaCena.has(key)) continue
        const atual = porNome.get(key)
        if (!atual || (!atual.participanteUid && p.participanteUid)) {
          porNome.set(key, { nome: p.nome, participanteUid: p.participanteUid })
        }
      }
    }
    return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }))
  }, [todasCenas, cena])

  function openEditModal() {
    if (!cena) return
    setNomeDraft(cena.nome)
    setLiderUidDraft(cena.liderUid ?? '')
    setRoteiroReferenciaDraft(cena.roteiroReferencia ?? '')
    setRoteiroUrlDraft(cena.roteiroUrl ?? '')
    setEditPersonagensRecorrentesSelecionados(new Set())
    setEditError('')
    setEditModalOpen(true)
  }

  function toggleEditPersonagemRecorrente(key: string) {
    setEditPersonagensRecorrentesSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSaveEdit() {
    if (!cena || !currentUser) return
    const nome = nomeDraft.trim()
    const url = roteiroUrlDraft.trim()
    if (!nome) {
      setEditError('Preencha o nome.')
      return
    }
    if (url && !/^https?:\/\//i.test(url)) {
      setEditError('O link do roteiro precisa começar com http:// ou https://')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      const novosPersonagens = [...editPersonagensRecorrentesSelecionados].flatMap(key => {
        const origem = personagensRecorrentes.find(o => o.nome.trim().toLowerCase() === key)
        if (!origem) return []
        return [
          {
            id: crypto.randomUUID(),
            nome: origem.nome,
            recorrente: true,
            participanteUid: origem.participanteUid && cena.participantes.includes(origem.participanteUid) ? origem.participanteUid : undefined,
          },
        ]
      })
      await Promise.all([
        nome !== cena.nome ? updateCenaNome(cena.id, nome, currentUser.uid) : Promise.resolve(),
        liderUidDraft !== (cena.liderUid ?? '') ? updateCenaLider(cena.id, liderUidDraft || undefined, currentUser.uid) : Promise.resolve(),
        updateCenaRoteiro(cena.id, { referencia: roteiroReferenciaDraft.trim() || undefined, url: url || undefined }, currentUser.uid),
        novosPersonagens.length
          ? updateCenaPersonagens(cena.id, [...cena.personagens, ...novosPersonagens], currentUser.uid)
          : Promise.resolve(),
      ])
      if (liderUidDraft && liderUidDraft !== cena.liderUid && (users[liderUidDraft]?.role ?? 'participante') === 'participante') {
        await updateUserRole(liderUidDraft, 'lider')
        setUsers(prev => ({ ...prev, [liderUidDraft]: { ...prev[liderUidDraft], role: 'lider' } }))
      }
      setEditModalOpen(false)
    } catch {
      setEditError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  function openAddPersonagem() {
    setEditingPersonagemId(null)
    setPersonagemModo('novo')
    setPersonagemNomeDraft('')
    setPersonagemParticipanteDraft('')
    setPersonagemRecorrenteDraft(false)
    setPersonagemOrigemKey('')
    setPersonagemError('')
    setPersonagensBase(cena?.personagens ?? [])
    setPersonagemModalOpen(true)
  }

  function openEditPersonagem(p: Personagem) {
    setEditingPersonagemId(p.id)
    setPersonagemModo('novo')
    setPersonagemNomeDraft(p.nome)
    setPersonagemParticipanteDraft(p.participanteUid ?? '')
    setPersonagemRecorrenteDraft(!!p.recorrente)
    setPersonagemOrigemKey('')
    setPersonagemError('')
    setPersonagensBase(cena?.personagens ?? [])
    setPersonagemModalOpen(true)
  }

  /** Preenche nome/recorrente a partir do personagem de outra cena escolhido em `personagemOrigemKey`. */
  function selecionarPersonagemOrigem(key: string) {
    setPersonagemOrigemKey(key)
    const origem = personagensRecorrentes.find(o => o.nome.trim().toLowerCase() === key)
    if (!origem) return
    setPersonagemNomeDraft(origem.nome)
    setPersonagemRecorrenteDraft(true)
    const participanteUid = origem.participanteUid
    setPersonagemParticipanteDraft(participanteUid && cena?.participantes.includes(participanteUid) ? participanteUid : '')
  }

  /**
   * `keepOpen` é o "cadastro em lote": salva e deixa o modal aberto pra adicionar o próximo. Usa
   * `personagensBase` (atualizado a cada save) em vez de `cena.personagens` porque o snapshot do
   * Firestore ainda não voltou entre um clique e outro — se lesse de `cena` de novo, perderia o
   * personagem que acabou de salvar.
   */
  async function handleSavePersonagem(keepOpen: boolean) {
    if (!cena || !currentUser) return
    if (!editingPersonagemId && personagemModo === 'existente' && !personagemOrigemKey) {
      setPersonagemError('Selecione um personagem.')
      return
    }
    const nome = personagemNomeDraft.trim()
    if (!nome) {
      setPersonagemError('Preencha o nome do personagem.')
      return
    }
    setSavingPersonagem(true)
    setPersonagemError('')
    try {
      const participanteUid = personagemParticipanteDraft || undefined
      const recorrente = personagemRecorrenteDraft || undefined
      const next = editingPersonagemId
        ? personagensBase.map(p => (p.id === editingPersonagemId ? { ...p, nome, participanteUid, recorrente } : p))
        : [...personagensBase, { id: crypto.randomUUID(), nome, participanteUid, recorrente }]
      await updateCenaPersonagens(cena.id, next, currentUser.uid)
      setPersonagensBase(next)
      if (keepOpen) {
        setPersonagemModo('novo')
        setPersonagemNomeDraft('')
        setPersonagemParticipanteDraft('')
        setPersonagemRecorrenteDraft(false)
        setPersonagemOrigemKey('')
        personagemNomeInputRef.current?.focus()
      } else {
        setPersonagemModalOpen(false)
      }
    } catch {
      setPersonagemError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSavingPersonagem(false)
    }
  }

  async function handleDeletePersonagem() {
    if (!cena || !currentUser || !editingPersonagemId) return
    setSavingPersonagem(true)
    try {
      // Sai só da cena — o personagem continua na base (tela de Personagens).
      await preservarPersonagensNoCatalogo(personagensBase.filter(p => p.id === editingPersonagemId))
      const next = personagensBase.filter(p => p.id !== editingPersonagemId)
      await updateCenaPersonagens(cena.id, next, currentUser.uid)
      setPersonagensBase(next)
      setPersonagemModalOpen(false)
    } finally {
      setSavingPersonagem(false)
    }
  }

  function openAddParticipanteModal() {
    setParticipanteAddUid('')
    setParticipanteError('')
    setParticipanteModalOpen(true)
  }

  async function handleAddParticipante() {
    if (!cena || !currentUser || !participanteAddUid) {
      setParticipanteError('Selecione uma pessoa.')
      return
    }
    setSavingParticipante(true)
    setParticipanteError('')
    try {
      await updateCenaParticipantes(cena.id, [...cena.participantes, participanteAddUid], currentUser.uid)
      setParticipanteModalOpen(false)
    } catch {
      setParticipanteError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSavingParticipante(false)
    }
  }

  async function handleToggleAssistente(uid: string) {
    if (!cena || !currentUser) return
    setSavingParticipante(true)
    try {
      const atuais = cena.assistentes ?? []
      await updateCenaAssistentes(
        cena.id,
        atuais.includes(uid) ? atuais.filter(a => a !== uid) : [...atuais, uid],
        currentUser.uid,
      )
    } finally {
      setSavingParticipante(false)
    }
  }

  /** Remove o participante da cena e desfaz qualquer vínculo dele (líder, assistente, personagem) pra não deixar referência solta. */
  async function handleRemoveParticipante(uid: string) {
    if (!cena || !currentUser) return
    setSavingParticipante(true)
    try {
      const tasks: Promise<void>[] = [updateCenaParticipantes(cena.id, cena.participantes.filter(p => p !== uid), currentUser.uid)]
      if (cena.liderUid === uid) tasks.push(updateCenaLider(cena.id, undefined, currentUser.uid))
      if (cena.assistentes?.includes(uid)) {
        tasks.push(updateCenaAssistentes(cena.id, cena.assistentes.filter(a => a !== uid), currentUser.uid))
      }
      if (cena.personagens.some(p => p.participanteUid === uid)) {
        tasks.push(
          updateCenaPersonagens(
            cena.id,
            cena.personagens.map(p => (p.participanteUid === uid ? { ...p, participanteUid: undefined } : p)),
            currentUser.uid,
          ),
        )
      }
      await Promise.all(tasks)
    } finally {
      setSavingParticipante(false)
    }
  }

  function openAgendaModal() {
    if (!cena) return
    setAgendaDiasDraft(cena.dias)
    setAgendaHorarioMode(cena.horarios ? 'porDia' : 'comum')
    setAgendaHorarioDraft(cena.horario ?? '')
    setAgendaHorariosPorDiaDraft(cena.horarios ?? {})
    setAgendaInicioDraft(cena.inicioEnsaios ?? '')
    setAgendaError('')
    setAgendaModalOpen(true)
  }

  function toggleAgendaDia(dia: DiaSemana) {
    setAgendaDiasDraft(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  async function handleSaveAgenda() {
    if (!cena || !currentUser) return
    if (agendaDiasDraft.length === 0) {
      setAgendaError('Selecione ao menos um dia.')
      return
    }
    if (agendaHorarioMode === 'comum' && !agendaHorarioDraft) {
      setAgendaError('Preencha o horário.')
      return
    }
    if (agendaHorarioMode === 'porDia' && agendaDiasDraft.some(d => !agendaHorariosPorDiaDraft[d])) {
      setAgendaError('Preencha o horário de todos os dias selecionados.')
      return
    }
    setSavingAgenda(true)
    setAgendaError('')
    try {
      await updateCenaAgenda(
        cena.id,
        {
          dias: agendaDiasDraft,
          horario: agendaHorarioMode === 'comum' ? agendaHorarioDraft : undefined,
          horarios: agendaHorarioMode === 'porDia' ? Object.fromEntries(agendaDiasDraft.map(d => [d, agendaHorariosPorDiaDraft[d]])) : undefined,
          inicioEnsaios: agendaInicioDraft || undefined,
        },
        currentUser.uid,
      )
      setAgendaModalOpen(false)
    } catch {
      setAgendaError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSavingAgenda(false)
    }
  }

  function openConfirmModal() {
    const pending = weekOccurrences.filter(o => !ensaiosByDate[o.dateKey] || isCanceled(ensaiosByDate[o.dateKey]))
    setConfirmSelections(Object.fromEntries(pending.map(o => [o.dateKey, true])))
    setConfirmDetails(Object.fromEntries(pending.map(o => [o.dateKey, { horario: o.horario, geral: false, comFigurino: false, roupa: '', levar: '', obrigatorios: [] }])))
    setConfirmModalOpen(true)
  }

  function updateConfirmDetail(dateKey: string, patch: Partial<ConfirmDetail>) {
    setConfirmDetails(prev => ({ ...prev, [dateKey]: { ...prev[dateKey], ...patch } }))
  }

  /**
   * Se já existe um registro pra essa data (cancelado antes), reconfirma o mesmo documento em vez
   * de criar outro — assim não fica um doc "cancelado" e outro "confirmado" pra mesma data — e
   * ainda assim aplica o horário/flags/obrigatórios definidos nessa confirmação.
   */
  async function handleConfirmEnsaios() {
    if (!cena || !currentUser) return
    setSavingConfirm(true)
    try {
      const toConfirm = weekOccurrences.filter(o => confirmSelections[o.dateKey] && (!ensaiosByDate[o.dateKey] || isCanceled(ensaiosByDate[o.dateKey])))
      await Promise.all(
        toConfirm.map(o => {
          const detail = confirmDetails[o.dateKey] ?? { horario: o.horario, geral: false, comFigurino: false, roupa: '', levar: '', obrigatorios: [] }
          const existing = ensaiosByDate[o.dateKey]
          // Depois de criar/reconfirmar (que zera as respostas), quem marcou a data como
          // indisponível na inscrição já entra como "não vai".
          const indisponiveis = uidsIndisponiveis(cena, o.dateKey, inscricoesByUid)
          return existing
            ? Promise.all([
                reconfirmarEnsaio(existing.id, currentUser.uid).then(() => aplicarIndisponibilidades(existing.id, indisponiveis)),
                updateEnsaioHorario(existing.id, detail.horario),
                updateEnsaioObrigatorios(existing.id, detail.obrigatorios),
                updateEnsaioFlags(existing.id, { geral: detail.geral, comFigurino: detail.comFigurino }),
                updateEnsaioPreparo(existing.id, { roupa: detail.roupa, levar: detail.levar }),
              ])
            : createEnsaio(cena.id, o.dateKey, detail.horario, currentUser.uid, detail.obrigatorios, {
                geral: detail.geral,
                comFigurino: detail.comFigurino,
                roupa: detail.roupa,
                levar: detail.levar,
              }).then(novoId => aplicarIndisponibilidades(novoId, indisponiveis))
        }),
      )
      setConfirmModalOpen(false)
    } finally {
      setSavingConfirm(false)
    }
  }

  // Cancelar pela lista da semana: o X abre a escolha de avisar ou não o elenco.
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)
  const [notificarCancelamento, setNotificarCancelamento] = useState(true)
  async function handleUnconfirm(ensaio: Ensaio) {
    if (!currentUser) return
    setSavingConfirm(true)
    try {
      await cancelarEnsaio(ensaio.id, currentUser.uid, notificarCancelamento)
      setCancelandoId(null)
    } finally {
      setSavingConfirm(false)
    }
  }

  // Cancelar direto pela agenda (sem entrar na página do ensaio).
  const [cancelarDaAgenda, setCancelarDaAgenda] = useState<Ensaio | null>(null)
  const [notificarDaAgenda, setNotificarDaAgenda] = useState(true)
  const [cancelandoDaAgenda, setCancelandoDaAgenda] = useState(false)
  const [erroCancelarDaAgenda, setErroCancelarDaAgenda] = useState('')
  function abrirCancelarDaAgenda(ensaio: Ensaio) {
    setNotificarDaAgenda(true)
    setErroCancelarDaAgenda('')
    setCancelarDaAgenda(ensaio)
  }
  async function handleCancelarDaAgenda() {
    if (!currentUser || !cancelarDaAgenda) return
    setCancelandoDaAgenda(true)
    try {
      await cancelarEnsaio(cancelarDaAgenda.id, currentUser.uid, notificarDaAgenda)
      setCancelarDaAgenda(null)
    } catch {
      setErroCancelarDaAgenda('Não foi possível cancelar. Tente de novo.')
    } finally {
      setCancelandoDaAgenda(false)
    }
  }

  async function handleConfirmPresenca(ensaio: Ensaio) {
    if (!currentUser) return
    setConfirmingPresenca(true)
    try {
      await confirmarPresenca(ensaio.id, currentUser.uid)
    } finally {
      setConfirmingPresenca(false)
    }
  }

  function toggleObrigatorio(personagemId: string, draft: string[], setDraft: (v: string[]) => void) {
    setDraft(draft.includes(personagemId) ? draft.filter(id => id !== personagemId) : [...draft, personagemId])
  }

  function toggleAllObrigatorios(allIds: string[], draft: string[], setDraft: (v: string[]) => void) {
    setDraft(allIds.every(id => draft.includes(id)) ? [] : allIds)
  }

  const hasPendingConfirmation = weekOccurrences.some(o => !ensaiosByDate[o.dateKey] || isCanceled(ensaiosByDate[o.dateKey]))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/cenas">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white flex-1 truncate">{cena?.nome ?? 'Cena'}</h1>
        {isAdmin && cena && (
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 shrink-0" onClick={openEditModal} title="Editar cena">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {cena === undefined && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {cena === null && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">Essa cena não existe (ou foi excluída).</CardContent>
        </Card>
      )}

      {cena && (
        <>
          <Card>
            <CardContent>
              <div className={cn(agendaOpen && 'pb-2.5 border-b border-gray-100')}>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setAgendaOpen(v => !v)}
                    className="flex flex-1 items-center gap-1.5 text-left text-base font-semibold"
                  >
                    <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !agendaOpen && '-rotate-90')} />
                    Agenda de Ensaios
                  </button>
                  {canManageAgenda && (
                    <div className="flex gap-1 shrink-0">
                      {canManageCena && (
                        <Button variant="ghost" size="icon" onClick={openAgendaModal} title="Editar agenda">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant={hasPendingConfirmation ? 'default' : 'outline'}
                        size="icon"
                        onClick={openConfirmModal}
                        title="Confirmar ensaios da semana"
                        className={cn(!hasPendingConfirmation && 'border-primary text-primary')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {agendaOpen && (
                <div className="space-y-3 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                    {sortDias(cena.dias).map(d => {
                      const horario = horarioDoDia(cena, d)
                      const isTodayEnsaio = d === todayDia && todayHasEnsaio
                      return (
                        <Badge
                          key={d}
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            isTodayEnsaio ? 'bg-primary border-primary text-white font-semibold' : 'bg-sky-50 border-sky-200 text-sky-700',
                          )}
                        >
                          {DIA_SEMANA_LABELS[d]}
                          {horario && ` | ${formatHoraCompacta(horario)}`}
                        </Badge>
                      )
                    })}
                  </div>
                  {cena.inicioEnsaios && todayKey < cena.inicioEnsaios && (
                    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs bg-amber-50 border-amber-200 text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Ensaios começam em {new Date(`${cena.inicioEnsaios}T00:00:00`).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              )}

              {!agendaOpen && proximosEnsaios.length > 0 && (
                <div className="space-y-1 pt-3">
                  {proximosEnsaios.map(e => {
                    // Todos aqui já são ensaios confirmados pela cena; a cor e o rótulo mostram a
                    // resposta da própria pessoa (vou / não vou / falta confirmar).
                    const jaConfirmou = !!currentUser && !!e.presencas?.includes(currentUser.uid)
                    const naoVai = !!currentUser && uidsAusentes(e).includes(currentUser.uid)
                    const podeConfirmar = !!myPersonagem && !jaConfirmou && canCheckin(e.data, e.horario, checkinLimiteHoras)
                    return (
                      <div key={e.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!podeConfirmar || confirmingPresenca}
                          onClick={() => handleConfirmPresenca(e)}
                          title={podeConfirmar ? 'Toque pra confirmar presença' : undefined}
                          className="flex flex-1 items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-base"
                        >
                          <span
                            className={cn('h-2 w-2 shrink-0 rounded-full', jaConfirmou ? 'bg-emerald-500' : naoVai ? 'bg-red-400' : 'bg-primary')}
                          />
                          <span className="flex-1 truncate">
                            {formatRelativeDia(e.data, todayKey)} · {formatHoraCompacta(e.horario)}
                          </span>
                          {jaConfirmou ? (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                              <Check className="h-3.5 w-3.5" /> Vou
                            </span>
                          ) : naoVai ? (
                            <span className="shrink-0 text-xs font-medium text-red-500">Não vou</span>
                          ) : podeConfirmar ? (
                            <span className="shrink-0 text-xs font-medium text-primary">Confirmar</span>
                          ) : null}
                        </button>
                        {e.data === todayKey && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/cenas/${cena.id}/iniciar-ensaio`)}
                            title="Iniciar ensaio"
                            className="shrink-0 text-primary"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {agendaOpen && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setWeekBase(d => addDays(d, -7))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="flex-1 text-center text-sm font-medium">{weekLabel}</p>
                  <Button variant="ghost" size="icon" onClick={() => setWeekBase(d => addDays(d, 7))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                      {displayedWeek.map(date => {
                        const dateKey = toDateKey(date)
                        const ensaio = ensaiosByDate[dateKey]
                        const canceled = isCanceled(ensaio)
                        const ativo = ensaio && !canceled
                        const occurrence = !ensaio ? weekOccurrencesByDate[dateKey] : undefined
                        return (
                          <div key={dateKey} className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!ensaio && !canManageAgenda}
                            onClick={() =>
                              navigate(ensaio ? `/cenas/${cena.id}/ensaios/${ensaio.id}` : `/cenas/${cena.id}/ensaios/dia/${dateKey}`)
                            }
                            className={cn(
                              'flex flex-1 items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-base',
                              ativo && 'bg-primary text-white',
                              canceled && 'bg-red-50 text-red-400',
                              !ensaio && !occurrence && 'text-gray-600',
                              !ensaio && !!occurrence && 'border border-dashed border-amber-300 bg-amber-50 text-amber-700',
                              dateKey === todayKey && !ensaio && !occurrence && 'bg-amber-50',
                            )}
                          >
                            <span className={cn('w-14 shrink-0 text-xs', ativo ? 'text-white/80' : canceled ? 'text-red-300' : 'text-gray-400')}>
                              {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                            </span>
                            <span className="w-8 shrink-0 font-medium">{date.getDate()}</span>
                            <span className={cn('flex-1 truncate', canceled && 'line-through')}>
                              {ativo
                                ? ensaio.horario
                                : canceled
                                  ? 'Cancelado'
                                  : occurrence
                                    ? occurrence.horario
                                    : canManageAgenda
                                      ? 'Criar ensaio'
                                      : 'Sem ensaio'}
                            </span>
                            {!ensaio && !!occurrence && (
                              <span title="Aguardando confirmação" className="shrink-0">
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}
                            {ativo && ensaio.geral && (
                              <span title="Ensaio geral" className={cn('shrink-0', ativo && 'text-white')}>
                                <Star className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {ativo && ensaio.comFigurino && (
                              <span title="Ensaio com figurino" className={cn('shrink-0', ativo && 'text-white')}>
                                <Shirt className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {ativo && !!ensaio.obrigatorios?.length && (
                              <span
                                className={cn(
                                  'flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                  ativo && 'bg-white/15 text-white',
                                )}
                              >
                                <Check className="h-3 w-3" />
                                {
                                  ensaio.obrigatorios.filter(pid => {
                                    const uid = cena.personagens.find(p => p.id === pid)?.participanteUid
                                    return !!uid && !!ensaio.presencas?.includes(uid)
                                  }).length
                                }
                                /{ensaio.obrigatorios.length}
                              </span>
                            )}
                            {!ensaio && !occurrence && canManageAgenda && <Plus className="h-4 w-4 shrink-0 text-gray-400" />}
                          </button>
                          {ativo && dateKey === todayKey && (
                            <Button
                              size="icon"
                              onClick={() => navigate(`/cenas/${cena.id}/iniciar-ensaio`)}
                              title="Iniciar ensaio"
                              className="shrink-0"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {ativo && canManageAgenda && dateKey >= todayKey && !ensaio.finalizadoAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirCancelarDaAgenda(ensaio)}
                              title="Cancelar ensaio"
                              aria-label="Cancelar ensaio"
                              className="shrink-0 text-gray-400 hover:text-red-600 active:text-red-600"
                            >
                              <CalendarX className="h-4 w-4" />
                            </Button>
                          )}
                          </div>
                        )
                      })}
                </div>
                {cena.inicioEnsaios && todayKey >= cena.inicioEnsaios && (
                  <p className="flex items-center gap-1 pt-2 text-[10px] text-gray-400">
                    <Info className="h-3 w-3 shrink-0" />
                    Ensaios desde {new Date(`${cena.inicioEnsaios}T00:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              )}
            </CardContent>
          </Card>

          {cena.roteiroUrl && (
            <Card>
              <CardContent className="py-4 space-y-2">
                <p className="text-sm font-medium">Roteiro</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-gray-600 truncate">{cena.roteiroReferencia || 'Sem referência'}</p>
                  <a href={cena.roteiroUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir roteiro
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <div className={cn('flex items-center justify-between gap-2', personagensOpen && 'pb-2.5 border-b border-gray-100')}>
                <button
                  type="button"
                  onClick={() => setPersonagensOpen(v => !v)}
                  className="flex flex-1 items-center gap-1.5 text-left text-base font-semibold"
                >
                  <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !personagensOpen && '-rotate-90')} />
                  Personagens
                </button>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={openAddPersonagem} className="shrink-0" title="Adicionar personagem">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {!personagensOpen &&
                cena.personagens.length > 0 &&
                (() => {
                  // O personagem de quem está vendo vai à direita, em destaque, e leva pra tela dele.
                  // Com dois ou mais personagens na mesma cena, fica tudo na fileira, como antes.
                  const meus = personagensOrdenados.filter(p => !!currentUser && p.participanteUid === currentUser.uid)
                  const meu = meus.length === 1 ? meus[0] : undefined
                  return (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <AvatarStack
                        items={personagensOrdenados
                          .filter(p => p.id !== meu?.id)
                          .map(p => ({
                            key: p.id,
                            photoURL: p.participanteUid ? users[p.participanteUid]?.photoURL : undefined,
                            name: p.nome,
                          }))}
                        className="flex-1"
                      />
                      {meu && (
                        <Link
                          to={`/cenas/${cena.id}/personagens/${meu.id}`}
                          title={`Seu personagem: ${meu.nome}`}
                          className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 py-1 pl-1 pr-3 ring-1 ring-primary/30 hover:bg-primary/15"
                        >
                          <Avatar photoURL={currentUser?.photoURL} name={meu.nome} className="h-7 w-7 text-[10px] ring-2 ring-primary" />
                          <span className="max-w-[9rem] truncate text-xs font-semibold text-primary">{meu.nome}</span>
                        </Link>
                      )}
                    </div>
                  )
                })()}

              {personagensOpen &&
                (cena.personagens?.length ? (
                  <div className="space-y-1 pt-2">
                    {personagensOrdenados.map(p => (
                      <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                        <Link to={`/cenas/${cena.id}/personagens/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                          <Avatar
                            photoURL={p.participanteUid ? users[p.participanteUid]?.photoURL : undefined}
                            name={p.nome}
                            className="h-9 w-9 text-xs"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-sm font-medium">
                              <span className="min-w-0 truncate">{p.nome}</span>
                              {p.recorrente && (
                                <span title="Personagem recorrente em outras cenas" className="shrink-0 text-primary">
                                  <Pin className="h-3 w-3" />
                                </span>
                              )}
                            </p>
                            {p.participanteUid && (
                              <p className="text-xs text-gray-500 truncate">
                                {p.participanteUid === currentUser?.uid ? 'Você' : nameFor(p.participanteUid)}
                              </p>
                            )}
                          </div>
                        </Link>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditPersonagem(p)}
                            className="shrink-0"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-2">Nenhum personagem cadastrado ainda.</p>
                ))}
            </CardContent>
          </Card>

          <MusicasCard cena={cena} recolhivel ocultarSeVazio={!canManageCena} />

          <RoteiroCenaCard
            cena={cena}
            isAdmin={isAdmin}
            meusPersonagens={cena.personagens.filter(p => p.participanteUid && p.participanteUid === currentUser?.uid).map(p => p.nome)}
          />

          {tempoDeEnsaio.ensaios > 0 && (
            <Card>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-1.5 text-base font-semibold">
                  <Timer className="h-4 w-4 text-primary" />
                  Tempo de ensaio
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-primary/10 px-2 py-2.5">
                    <p className="text-lg font-bold text-primary">{formatTempoTotal(tempoDeEnsaio.total)}</p>
                    <p className="text-[11px] text-muted-foreground">no total</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-2 py-2.5">
                    <p className="text-lg font-bold text-gray-900">{tempoDeEnsaio.ensaios}</p>
                    <p className="text-[11px] text-muted-foreground">{tempoDeEnsaio.ensaios === 1 ? 'ensaio' : 'ensaios'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-2 py-2.5">
                    <p className="text-lg font-bold text-gray-900">{formatTempoTotal(tempoDeEnsaio.media)}</p>
                    <p className="text-[11px] text-muted-foreground">por ensaio</p>
                  </div>
                </div>
                {registros.length > tempoDeEnsaio.ensaios && (
                  <p className="text-[11px] text-muted-foreground">
                    {registros.length - tempoDeEnsaio.ensaios} ensaio(s) encerrado(s) sem tempo registrado ficaram de fora.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {registros.length > 0 && (
            <Card>
              <CardContent>
                <div className={cn('flex items-center gap-2', anotacoesOpen && 'pb-2.5 border-b border-gray-100')}>
                  <button
                    type="button"
                    onClick={() => setAnotacoesOpen(v => !v)}
                    className="flex flex-1 items-center gap-1.5 text-left text-base font-semibold"
                  >
                    <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !anotacoesOpen && '-rotate-90')} />
                    Anotações
                  </button>
                  <span className="text-xs text-muted-foreground">{registros.length}</span>
                </div>

                {anotacoesOpen && (
                  <div className="space-y-1 pt-2">
                    {registros.map(e => {
                      const elencoCount = cena.personagens.filter(p => p.participanteUid).length
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => navigate(`/cenas/${cena.id}/ensaios/${e.id}`)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          <NotebookPen className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {formatRelativeDia(e.data, todayKey)} · {formatHoraCompacta(e.horario)}
                            </p>
                            {e.anotacoes && <p className="truncate text-xs text-gray-500">{e.anotacoes}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            {e.duracaoSegundos !== undefined && <span>{formatDuracao(e.duracaoSegundos)}</span>}
                            <span>
                              {e.presencas?.length ?? 0}/{elencoCount}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Só com ensaio confirmado (e não cancelado) pra hoje — sem isso não tem o que iniciar. */}
          {temEnsaioHoje && (
            <Button className="w-full gap-1.5" onClick={() => navigate(`/cenas/${cena.id}/iniciar-ensaio`)}>
              <Play className="h-4 w-4" />
              Iniciar ensaio
            </Button>
          )}

          <AprovacoesFigurinoCard cena={cena} users={users} />

          <FigurinosCard cena={cena} titulo="Figurinos" recolhivel ocultarSeVazio={!canManageCena} />

          <ReferenciasEquipeCard cena={cena} />

          <Card>
            <CardContent>
              <div className={cn('flex items-center justify-between gap-2', participantesOpen && 'pb-2.5 border-b border-gray-100')}>
                <button
                  type="button"
                  onClick={() => setParticipantesOpen(v => !v)}
                  className="flex flex-1 items-center gap-1.5 text-left text-base font-semibold"
                >
                  <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !participantesOpen && '-rotate-90')} />
                  Grupo
                </button>
                {canManageCena && (
                  <Button variant="ghost" size="icon" onClick={openAddParticipanteModal} className="shrink-0" title="Adicionar participante">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {!participantesOpen && (outrosParticipantes.length > 0 || cena.liderUid) && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  {/* Fileira: só quem não é assistente; os assistentes ficam ao lado do líder, com selo. */}
                  <AvatarStack
                    items={outrosParticipantes
                      .filter(uid => !cena.assistentes?.includes(uid))
                      .map(uid => ({ key: uid, photoURL: users[uid]?.photoURL, name: nameFor(uid) }))}
                    className="flex-1"
                  />
                  {outrosParticipantes
                    .filter(uid => cena.assistentes?.includes(uid))
                    .map(uid => (
                      <button
                        key={uid}
                        type="button"
                        title={`Assistente: ${nameFor(uid)}`}
                        className="relative shrink-0"
                        onClick={() => setPessoaModal(uid)}
                      >
                        <Avatar photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-7 w-7 text-[10px] ring-2 ring-primary/70" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-2 ring-white">
                          <HandHelping className="h-2.5 w-2.5 text-white" />
                        </span>
                      </button>
                    ))}
                  {cena.liderUid && (
                    <button
                      type="button"
                      title={`Líder: ${nameFor(cena.liderUid)}`}
                      className="relative shrink-0"
                      onClick={() => setPessoaModal(cena.liderUid!)}
                    >
                      <Avatar photoURL={users[cena.liderUid]?.photoURL} name={nameFor(cena.liderUid)} className="h-7 w-7 text-[10px] ring-2 ring-amber-400" />
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
                        <Crown className="h-2.5 w-2.5 text-white" />
                      </span>
                    </button>
                  )}
                </div>
              )}

              {participantesOpen &&
                (outrosParticipantes.length || cena.liderUid ? (
                  <div className="space-y-1 pt-2">
                    {cena.liderUid && (
                      <PessoaLinha
                        pessoa={pessoaOpcao(cena.liderUid, users[cena.liderUid], inscricoesByUid[cena.liderUid])}
                        funcao="lider"
                        onClick={() => setPessoaModal(cena.liderUid!)}
                        className="rounded-lg px-1 py-1.5"
                      />
                    )}
                    {outrosParticipantes.map(uid => {
                      const assistente = !!cena.assistentes?.includes(uid)
                      return (
                        <PessoaLinha
                          key={uid}
                          pessoa={pessoaOpcao(uid, users[uid], inscricoesByUid[uid])}
                          funcao={assistente ? 'assistente' : undefined}
                          onClick={() => setPessoaModal(uid)}
                          className="rounded-lg px-1 py-1.5"
                        >
                          {canManageCena && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleAssistente(uid)}
                              disabled={savingParticipante}
                              className={cn('shrink-0', assistente ? 'text-primary' : 'text-gray-300')}
                              title={assistente ? 'Deixar de ser assistente' : 'Tornar assistente'}
                              aria-pressed={assistente}
                            >
                              <HandHelping className="h-4 w-4" />
                            </Button>
                          )}
                          {(canManageCena || (isAssistenteDaCena && !assistente)) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveParticipante(uid)}
                              disabled={savingParticipante}
                              className="shrink-0"
                              title="Remover"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </PessoaLinha>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-2">Nenhum participante cadastrado ainda.</p>
                ))}
            </CardContent>
          </Card>
        </>
      )}

      {cancelarDaAgenda && (
        <Dialog open onClose={() => setCancelarDaAgenda(null)} title="Cancelar ensaio">
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              {formatRelativeDia(cancelarDaAgenda.data, todayKey)} · {formatHoraCompacta(cancelarDaAgenda.horario)} — o registro continua
              visível como cancelado e pode ser reconfirmado depois (as presenças são zeradas).
            </p>
            <NotificarElenco value={notificarDaAgenda} onChange={setNotificarDaAgenda} />
            {erroCancelarDaAgenda && <p className="text-sm text-red-600">{erroCancelarDaAgenda}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelarDaAgenda(null)} disabled={cancelandoDaAgenda}>
                Voltar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleCancelarDaAgenda} disabled={cancelandoDaAgenda}>
                {cancelandoDaAgenda && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Cancelar ensaio
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {cena && pessoaModal && (
        <ContatoPessoaDialog
          uid={pessoaModal}
          funcao={pessoaModal === cena.liderUid ? 'lider' : cena.assistentes?.includes(pessoaModal) ? 'assistente' : 'participante'}
          users={users}
          inscricao={inscricoesByUid[pessoaModal]}
          onClose={() => setPessoaModal(null)}
        />
      )}

      {cena && (
        <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar cena">
          <div className="space-y-4">
            <div>
              <Label htmlFor="cena-nome">Nome</Label>
              <Input id="cena-nome" value={nomeDraft} onChange={e => setNomeDraft(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="cena-lider">Líder</Label>
              <PessoaSelect
                id="cena-lider"
                value={liderUidDraft}
                onChange={setLiderUidDraft}
                pessoas={participantesOpcoes}
                extras={[{ value: '', label: 'Sem líder definido' }]}
                titulo="Líder da cena"
              />
              {liderUidDraft && (users[liderUidDraft]?.role ?? 'participante') === 'participante' && (
                <p className="text-xs text-muted-foreground mt-1">Essa pessoa vai virar Líder ao salvar.</p>
              )}
            </div>

            {personagensRecorrentes.length > 0 && (
              <div>
                <Label>Personagens recorrentes ({editPersonagensRecorrentesSelecionados.size})</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                  Já cadastrados em outras cenas — selecione pra reaproveitar nessa.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-1.5">
                  {personagensRecorrentes.map(o => {
                    const key = o.nome.trim().toLowerCase()
                    const selecionado = editPersonagensRecorrentesSelecionados.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleEditPersonagemRecorrente(key)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                          selecionado ? 'bg-primary/10' : 'hover:bg-gray-50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                            selecionado ? 'border-primary bg-primary text-white' : 'border-gray-300',
                          )}
                        >
                          {selecionado && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <Avatar
                          photoURL={o.participanteUid ? users[o.participanteUid]?.photoURL : undefined}
                          name={o.nome}
                          className="h-6 w-6 shrink-0 text-[10px]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{o.nome}</p>
                          {o.participanteUid && (
                            <p className="truncate text-[11px] text-muted-foreground">{nameFor(o.participanteUid)}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="roteiro-referencia">Referência do roteiro (opcional)</Label>
              <Input
                id="roteiro-referencia"
                value={roteiroReferenciaDraft}
                onChange={e => setRoteiroReferenciaDraft(e.target.value)}
                placeholder="Ex.: Ato 1 - Cena 3"
              />
            </div>
            <div>
              <Label htmlFor="roteiro-url">Link do roteiro (opcional)</Label>
              <Input
                id="roteiro-url"
                type="url"
                value={roteiroUrlDraft}
                onChange={e => setRoteiroUrlDraft(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {editError && <p className="text-sm text-red-600">{editError}</p>}

            <Button className="w-full" onClick={handleSaveEdit} disabled={saving}>
              {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar
            </Button>
          </div>
        </Dialog>
      )}

      {cena && (
        <Dialog
          open={personagemModalOpen}
          onClose={() => setPersonagemModalOpen(false)}
          title={editingPersonagemId ? 'Editar personagem' : 'Novo personagem'}
        >
          <div className="space-y-4">
            {!editingPersonagemId && personagensRecorrentes.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPersonagemModo('novo')}
                  className={cn(
                    'rounded-lg border py-2 text-sm font-medium transition-colors',
                    personagemModo === 'novo' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  Novo personagem
                </button>
                <button
                  type="button"
                  onClick={() => setPersonagemModo('existente')}
                  className={cn(
                    'rounded-lg border py-2 text-sm font-medium transition-colors',
                    personagemModo === 'existente' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  De outra cena
                </button>
              </div>
            )}

            {!editingPersonagemId && personagemModo === 'existente' ? (
              <div>
                <Label htmlFor="personagem-origem">Personagem</Label>
                <Select
                  id="personagem-origem"
                  value={personagemOrigemKey}
                  onChange={e => selecionarPersonagemOrigem(e.target.value)}
                  className="mt-1.5"
                >
                  <option value="">Selecione um personagem</option>
                  {personagensRecorrentes.map(o => (
                    <option key={o.nome.trim().toLowerCase()} value={o.nome.trim().toLowerCase()}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div>
                <Label htmlFor="personagem-nome">Nome</Label>
                <Input
                  ref={personagemNomeInputRef}
                  id="personagem-nome"
                  value={personagemNomeDraft}
                  onChange={e => setPersonagemNomeDraft(e.target.value)}
                  placeholder="Nome do personagem"
                  autoFocus
                />
              </div>
            )}

            <div>
              <Label htmlFor="personagem-participante">Participante</Label>
              <PessoaSelect
                id="personagem-participante"
                value={personagemParticipanteDraft}
                onChange={setPersonagemParticipanteDraft}
                pessoas={participantesOpcoes}
                extras={[{ value: '', label: 'Sem participante' }]}
                titulo="Quem interpreta"
              />
            </div>

            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <span className="text-sm text-gray-700">Personagem recorrente em outras cenas</span>
              <input
                type="checkbox"
                checked={personagemRecorrenteDraft}
                onChange={e => setPersonagemRecorrenteDraft(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </label>

            {personagemError && <p className="text-sm text-red-600">{personagemError}</p>}

            {editingPersonagemId ? (
              <Button className="w-full" onClick={() => handleSavePersonagem(false)} disabled={savingPersonagem}>
                {savingPersonagem && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Salvar
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button className="w-full" onClick={() => handleSavePersonagem(true)} disabled={savingPersonagem || !personagemNomeDraft.trim()}>
                  {savingPersonagem && <Spinner size="sm" className="border-white/40 border-t-white" />}
                  Salvar e adicionar outro
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSavePersonagem(false)}
                  disabled={savingPersonagem || !personagemNomeDraft.trim()}
                >
                  Salvar e fechar
                </Button>
              </div>
            )}
            {editingPersonagemId && (
              <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={handleDeletePersonagem} disabled={savingPersonagem}>
                <Trash2 className="h-4 w-4" />
                Remover da cena
              </Button>
            )}
          </div>
        </Dialog>
      )}

      {cena && (
        <Dialog open={participanteModalOpen} onClose={() => setParticipanteModalOpen(false)} title="Adicionar participante">
          <div className="space-y-4">
            <div>
              <Label htmlFor="participante-add">Pessoa</Label>
              <PessoaSelect
                id="participante-add"
                value={participanteAddUid}
                onChange={setParticipanteAddUid}
                pessoas={availableParaAdicionar.map(i => pessoaOpcao(i.uid, users[i.uid], i))}
                titulo="Adicionar participante"
              />
              {availableParaAdicionar.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Não há mais ninguém disponível pra adicionar.</p>
              )}
            </div>

            {participanteError && <p className="text-sm text-red-600">{participanteError}</p>}

            <Button className="w-full" onClick={handleAddParticipante} disabled={savingParticipante || !participanteAddUid}>
              {savingParticipante && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Adicionar
            </Button>
          </div>
        </Dialog>
      )}

      {cena && (
        <Dialog open={agendaModalOpen} onClose={() => setAgendaModalOpen(false)} title="Editar agenda">
          <div className="space-y-4">
            <div>
              <Label>Dia(s)</Label>
              <div className="grid grid-cols-6 gap-1.5 mt-1.5">
                {DIAS_ORDER.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleAgendaDia(d)}
                    className={cn(
                      'rounded-lg border py-2.5 text-sm font-medium transition-colors',
                      agendaDiasDraft.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                    )}
                  >
                    {DIA_SEMANA_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Horário</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => setAgendaHorarioMode('comum')}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-medium transition-colors',
                    agendaHorarioMode === 'comum' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  Horário comum
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaHorarioMode('porDia')}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-medium transition-colors',
                    agendaHorarioMode === 'porDia' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  Horário por dia
                </button>
              </div>
              {agendaHorarioMode === 'comum' ? (
                <Input type="time" value={agendaHorarioDraft} onChange={e => setAgendaHorarioDraft(e.target.value)} />
              ) : agendaDiasDraft.length === 0 ? (
                <p className="text-xs text-muted-foreground">Selecione ao menos um dia primeiro.</p>
              ) : (
                <div className="space-y-1.5">
                  {sortDias(agendaDiasDraft).map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs font-medium text-gray-600">{DIA_SEMANA_LABELS[d]}</span>
                      <Input
                        type="time"
                        value={agendaHorariosPorDiaDraft[d] ?? ''}
                        onChange={e => setAgendaHorariosPorDiaDraft(prev => ({ ...prev, [d]: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="agenda-inicio">Início dos ensaios (opcional)</Label>
              <Input id="agenda-inicio" type="date" value={agendaInicioDraft} onChange={e => setAgendaInicioDraft(e.target.value)} />
            </div>

            {agendaError && <p className="text-sm text-red-600">{agendaError}</p>}

            <Button className="w-full" onClick={handleSaveAgenda} disabled={savingAgenda}>
              {savingAgenda && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar
            </Button>
          </div>
        </Dialog>
      )}

      {cena && (
        <Dialog open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirmar ensaios da semana">
          <div className="space-y-3">
            {weekOccurrences.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum ensaio previsto pra essa semana.</p>
            )}
            {weekOccurrences.map(o => {
              const ensaio = ensaiosByDate[o.dateKey]
              const canceled = isCanceled(ensaio)
              const confirmado = ensaio && !canceled ? ensaio : undefined
              const detail = confirmDetails[o.dateKey]
              return (
                <div
                  key={o.dateKey}
                  className={cn(
                    'rounded-lg border px-3 py-2.5',
                    confirmado ? 'border-emerald-200 bg-emerald-50' : canceled ? 'border-red-200 bg-red-50' : 'border-gray-200',
                  )}
                >
                  <div className="flex items-center gap-3">
                    {confirmado ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!confirmSelections[o.dateKey]}
                        onChange={e => setConfirmSelections(prev => ({ ...prev, [o.dateKey]: e.target.checked }))}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {DIA_SEMANA_LABELS[o.dia]} · {o.date.toLocaleDateString('pt-BR')}
                      </p>
                      {confirmado ? (
                        <p className="text-xs text-gray-500">{confirmado.horario}</p>
                      ) : canceled ? (
                        <p className="text-xs text-gray-500">{o.horario} · cancelado</p>
                      ) : null}
                    </div>
                    {confirmado && cancelandoId !== confirmado.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setNotificarCancelamento(true)
                          setCancelandoId(confirmado.id)
                        }}
                        disabled={savingConfirm}
                        title="Cancelar"
                      >
                        <X className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                  </div>

                  {confirmado && cancelandoId === confirmado.id && (
                    <div className="mt-2.5 space-y-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                      <p className="text-xs text-red-700">Cancelar o ensaio desse dia?</p>
                      <NotificarElenco value={notificarCancelamento} onChange={setNotificarCancelamento} />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setCancelandoId(null)} disabled={savingConfirm}>
                          Voltar
                        </Button>
                        <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleUnconfirm(confirmado)} disabled={savingConfirm}>
                          Cancelar ensaio
                        </Button>
                      </div>
                    </div>
                  )}

                  {!confirmado && detail && (
                    <div className="mt-2.5 space-y-2 pl-7">
                      <Input
                        type="time"
                        value={detail.horario}
                        onChange={e => updateConfirmDetail(o.dateKey, { horario: e.target.value })}
                        className="h-8 w-28 text-sm"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateConfirmDetail(o.dateKey, { geral: !detail.geral })}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            detail.geral ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
                          )}
                        >
                          <Star className="h-3.5 w-3.5" />
                          Ensaio geral
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfirmDetail(o.dateKey, { comFigurino: !detail.comFigurino })}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            detail.comFigurino ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
                          )}
                        >
                          <Shirt className="h-3.5 w-3.5" />
                          Com figurino
                        </button>
                      </div>
                      <PreparoCampos
                        compacto
                        idPrefixo={`confirmar-${o.dateKey}`}
                        value={{ roupa: detail.roupa, levar: detail.levar }}
                        onChange={patch => updateConfirmDetail(o.dateKey, patch)}
                      />
                      {cena && cena.personagens.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Quem precisa estar</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                toggleAllObrigatorios(
                                  cena.personagens.map(p => p.id),
                                  detail.obrigatorios,
                                  next => updateConfirmDetail(o.dateKey, { obrigatorios: next }),
                                )
                              }
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                                cena.personagens.every(p => detail.obrigatorios.includes(p.id))
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-gray-300 bg-white text-gray-600',
                              )}
                            >
                              Todos
                            </button>
                            {cena.personagens.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  toggleObrigatorio(p.id, detail.obrigatorios, next => updateConfirmDetail(o.dateKey, { obrigatorios: next }))
                                }
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                  detail.obrigatorios.includes(p.id)
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-gray-300 bg-white text-gray-600',
                                )}
                              >
                                {p.nome}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {hasPendingConfirmation && (
              <Button className="w-full" onClick={handleConfirmEnsaios} disabled={savingConfirm}>
                {savingConfirm && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Confirmar selecionados
              </Button>
            )}
          </div>
        </Dialog>
      )}
    </div>
  )
}
