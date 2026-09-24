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
  Image,
  MessageCircle,
  Music,
  NotebookPen,
  Pencil,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Shirt,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarStack } from '@/components/ui/AvatarStack'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers, updateUserRole } from '@/services/firebase/auth'
import {
  subscribeToCena,
  subscribeToCenas,
  updateCenaAgenda,
  updateCenaFigurinos,
  updateCenaLider,
  updateCenaMusicas,
  updateCenaNome,
  updateCenaParticipantes,
  updateCenaPersonagens,
  updateCenaRoteiro,
} from '@/services/firebase/cenas'
import { deleteCenaFile, uploadCenaFile } from '@/services/firebase/storage'
import {
  cancelarEnsaio,
  confirmarPresenca,
  createEnsaio,
  reconfirmarEnsaio,
  removerPresenca,
  salvarRegistroEnsaio,
  subscribeToEnsaiosDaCena,
  updateEnsaioFlags,
  updateEnsaioHorario,
  updateEnsaioObrigatorios,
} from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  DIA_SEMANA_LABELS,
  type AppUser,
  type Cena,
  type DiaSemana,
  type Ensaio,
  type FigurinoImagem,
  type Inscricao,
  type Musica,
  type Personagem,
} from '@/types'
import { DIAS_ORDER, sortDias } from '@/lib/dias'
import { formatDuracao, formatHoraCompacta, horarioDoDia } from '@/lib/cenaHorario'
import { FIGURINO_MAX_BYTES, MUSICA_MAX_BYTES } from '@/lib/uploads'
import { whatsappLink } from '@/lib/formatters'
import { addDays, canCheckin, DIA_TO_WEEKDAY, formatRelativeDia, toDateKey, weekDates } from '@/lib/agenda'
import { cn } from '@/lib/utils'

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

  const canManageAgenda = isAdmin || (!!cena && cena.liderUid === currentUser?.uid)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [liderModalOpen, setLiderModalOpen] = useState(false)
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
  const [ensaioRegistroAnotacoesDraft, setEnsaioRegistroAnotacoesDraft] = useState('')
  const [ensaioRegistroDuracaoDraft, setEnsaioRegistroDuracaoDraft] = useState('')
  const [savingEnsaioRegistro, setSavingEnsaioRegistro] = useState(false)

  const figurinoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFigurino, setUploadingFigurino] = useState(false)
  const [figurinoError, setFigurinoError] = useState('')
  const [figurinoViewerIndex, setFigurinoViewerIndex] = useState<number | null>(null)
  const [figurinoUploadModalOpen, setFigurinoUploadModalOpen] = useState(false)
  const [figurinoUploadEscopo, setFigurinoUploadEscopo] = useState<'geral' | 'personagem'>('geral')
  const [figurinoUploadPersonagemId, setFigurinoUploadPersonagemId] = useState('')
  const [figurinoDeleteTarget, setFigurinoDeleteTarget] = useState<FigurinoImagem | null>(null)

  const musicaInputRef = useRef<HTMLInputElement>(null)
  const trocarMusicaInputRef = useRef<HTMLInputElement>(null)
  const [uploadingMusica, setUploadingMusica] = useState(false)
  const [musicaError, setMusicaError] = useState('')
  const [trocandoMusicaId, setTrocandoMusicaId] = useState<string | null>(null)
  const [musicaDeleteTarget, setMusicaDeleteTarget] = useState<Musica | null>(null)
  const [musicaRenameTarget, setMusicaRenameTarget] = useState<Musica | null>(null)
  const [musicaRenameDraft, setMusicaRenameDraft] = useState('')
  const [savingMusicaRename, setSavingMusicaRename] = useState(false)

  const [weekBase, setWeekBase] = useState(() => new Date())

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
  const [selectedEnsaio, setSelectedEnsaio] = useState<Ensaio | null>(null)
  const [cancelingEnsaio, setCancelingEnsaio] = useState(false)
  const [confirmingPresenca, setConfirmingPresenca] = useState(false)
  const [obrigatoriosDraft, setObrigatoriosDraft] = useState<string[]>([])
  const [savingObrigatorios, setSavingObrigatorios] = useState(false)
  const [horarioDraft, setHorarioDraft] = useState('')
  const [savingHorario, setSavingHorario] = useState(false)
  const [geralDraft, setGeralDraft] = useState(false)
  const [comFigurinoDraft, setComFigurinoDraft] = useState(false)
  const [savingFlags, setSavingFlags] = useState(false)

  const [createEnsaioModalOpen, setCreateEnsaioModalOpen] = useState(false)
  const [createEnsaioDateKey, setCreateEnsaioDateKey] = useState('')
  const [createEnsaioHorarioDraft, setCreateEnsaioHorarioDraft] = useState('')
  const [createEnsaioObrigatoriosDraft, setCreateEnsaioObrigatoriosDraft] = useState<string[]>([])
  const [createEnsaioGeralDraft, setCreateEnsaioGeralDraft] = useState(false)
  const [createEnsaioComFigurinoDraft, setCreateEnsaioComFigurinoDraft] = useState(false)
  const [savingCreateEnsaio, setSavingCreateEnsaio] = useState(false)
  const [createEnsaioError, setCreateEnsaioError] = useState('')

  useEffect(() => {
    if (!id) return
    return subscribeToCena(id, setCena)
  }, [id])

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

  const ensaiosByDate = useMemo(() => Object.fromEntries((ensaios ?? []).map(e => [e.data, e])), [ensaios])
  const todayKey = toDateKey(new Date())
  const todayHasEnsaio = !!ensaiosByDate[todayKey]
  const todayDia = (Object.keys(DIA_TO_WEEKDAY) as DiaSemana[]).find(d => DIA_TO_WEEKDAY[d] === new Date().getDay())

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

  const outrosParticipantes = useMemo(
    () => (cena ? cena.participantes.filter(uid => uid !== cena.liderUid) : []),
    [cena?.participantes, cena?.liderUid],
  )

  /** Ensaios finalizados pela tela "Iniciar ensaio" — os registros exibidos no card Anotações. */
  const registros = useMemo(
    () => (ensaios ?? []).filter(e => e.finalizadoAt).sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario)),
    [ensaios],
  )

  /** Personagens recorrentes primeiro, na exibição da lista. */
  const personagensOrdenados = useMemo(
    () => [...(cena?.personagens ?? [])].sort((a, b) => Number(!!b.recorrente) - Number(!!a.recorrente)),
    [cena?.personagens],
  )

  /** Figurinos na ordem de exibição da galeria: gerais primeiro, depois agrupados por personagem. */
  const figurinosOrdenados = useMemo(() => {
    const figurinos = cena?.figurinos ?? []
    const gerais = figurinos.filter(f => !f.personagemId)
    const porPersonagem = (cena?.personagens ?? []).flatMap(p => figurinos.filter(f => f.personagemId === p.id))
    return [...gerais, ...porPersonagem]
  }, [cena?.figurinos, cena?.personagens])

  const availableParaAdicionar = useMemo(
    () =>
      (inscricoes ?? [])
        .filter(i => !cena?.participantes.includes(i.uid))
        .filter(i => i.areas.some(a => a === 'elenco' || a === 'tecnica'))
        .filter(i => !cena?.dias.length || cena.dias.every(d => i.disponibilidade.dias.includes(d)))
        .sort((a, b) => (a.apelido || a.nomeCompleto).localeCompare(b.apelido || b.nomeCompleto)),
    [inscricoes, cena?.participantes, cena?.dias],
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

  /** Remove o participante da cena e desfaz qualquer vínculo dele (líder, personagem) pra não deixar referência solta. */
  async function handleRemoveParticipante(uid: string) {
    if (!cena || !currentUser) return
    setSavingParticipante(true)
    try {
      const tasks: Promise<void>[] = [updateCenaParticipantes(cena.id, cena.participantes.filter(p => p !== uid), currentUser.uid)]
      if (cena.liderUid === uid) tasks.push(updateCenaLider(cena.id, undefined, currentUser.uid))
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
    setConfirmDetails(Object.fromEntries(pending.map(o => [o.dateKey, { horario: o.horario, geral: false, comFigurino: false, obrigatorios: [] }])))
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
          const detail = confirmDetails[o.dateKey] ?? { horario: o.horario, geral: false, comFigurino: false, obrigatorios: [] }
          const existing = ensaiosByDate[o.dateKey]
          return existing
            ? Promise.all([
                reconfirmarEnsaio(existing.id, currentUser.uid),
                updateEnsaioHorario(existing.id, detail.horario),
                updateEnsaioObrigatorios(existing.id, detail.obrigatorios),
                updateEnsaioFlags(existing.id, { geral: detail.geral, comFigurino: detail.comFigurino }),
              ])
            : createEnsaio(cena.id, o.dateKey, detail.horario, currentUser.uid, detail.obrigatorios, {
                geral: detail.geral,
                comFigurino: detail.comFigurino,
              })
        }),
      )
      setConfirmModalOpen(false)
    } finally {
      setSavingConfirm(false)
    }
  }

  async function handleUnconfirm(ensaio: Ensaio) {
    if (!currentUser) return
    setSavingConfirm(true)
    try {
      await cancelarEnsaio(ensaio.id, currentUser.uid)
    } finally {
      setSavingConfirm(false)
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

  async function handleCancelSelectedEnsaio() {
    if (!selectedEnsaio || !currentUser) return
    setCancelingEnsaio(true)
    try {
      await cancelarEnsaio(selectedEnsaio.id, currentUser.uid)
      setSelectedEnsaio({ ...selectedEnsaio, canceledByUid: currentUser.uid, canceledAt: new Date().toISOString() })
    } finally {
      setCancelingEnsaio(false)
    }
  }

  async function handleReconfirmSelectedEnsaio() {
    if (!selectedEnsaio || !currentUser) return
    setCancelingEnsaio(true)
    try {
      await reconfirmarEnsaio(selectedEnsaio.id, currentUser.uid)
      setSelectedEnsaio({
        ...selectedEnsaio,
        canceledByUid: undefined,
        canceledAt: undefined,
        presencas: [],
        confirmedByUid: currentUser.uid,
        confirmedAt: new Date().toISOString(),
      })
    } finally {
      setCancelingEnsaio(false)
    }
  }

  function toggleObrigatorio(personagemId: string, draft: string[], setDraft: (v: string[]) => void) {
    setDraft(draft.includes(personagemId) ? draft.filter(id => id !== personagemId) : [...draft, personagemId])
  }

  function toggleAllObrigatorios(allIds: string[], draft: string[], setDraft: (v: string[]) => void) {
    setDraft(allIds.every(id => draft.includes(id)) ? [] : allIds)
  }

  function openCreateEnsaioModal(date: Date) {
    if (!cena) return
    const dateKey = toDateKey(date)
    const dia = (Object.keys(DIA_TO_WEEKDAY) as DiaSemana[]).find(d => DIA_TO_WEEKDAY[d] === date.getDay())
    setCreateEnsaioDateKey(dateKey)
    setCreateEnsaioHorarioDraft((dia && horarioDoDia(cena, dia)) || cena.horario || '')
    setCreateEnsaioObrigatoriosDraft([])
    setCreateEnsaioGeralDraft(false)
    setCreateEnsaioComFigurinoDraft(false)
    setCreateEnsaioError('')
    setCreateEnsaioModalOpen(true)
  }

  async function handleCreateEnsaio() {
    if (!cena || !currentUser || !createEnsaioDateKey) return
    if (!createEnsaioHorarioDraft) {
      setCreateEnsaioError('Preencha o horário.')
      return
    }
    setSavingCreateEnsaio(true)
    setCreateEnsaioError('')
    try {
      await createEnsaio(cena.id, createEnsaioDateKey, createEnsaioHorarioDraft, currentUser.uid, createEnsaioObrigatoriosDraft, {
        geral: createEnsaioGeralDraft,
        comFigurino: createEnsaioComFigurinoDraft,
      })
      setCreateEnsaioModalOpen(false)
    } catch {
      setCreateEnsaioError('Não foi possível criar o ensaio. Tente de novo.')
    } finally {
      setSavingCreateEnsaio(false)
    }
  }

  function openSelectedEnsaio(ensaio: Ensaio) {
    setObrigatoriosDraft(ensaio.obrigatorios ?? [])
    setHorarioDraft(ensaio.horario)
    setGeralDraft(!!ensaio.geral)
    setComFigurinoDraft(!!ensaio.comFigurino)
    setEnsaioRegistroAnotacoesDraft(ensaio.anotacoes ?? '')
    setEnsaioRegistroDuracaoDraft(ensaio.duracaoSegundos !== undefined ? String(Math.round(ensaio.duracaoSegundos / 60)) : '')
    setSelectedEnsaio(ensaio)
  }

  async function toggleSelectedPresenca(uid: string) {
    if (!selectedEnsaio) return
    const presente = selectedEnsaio.presencas?.includes(uid)
    if (presente) await removerPresenca(selectedEnsaio.id, uid)
    else await confirmarPresenca(selectedEnsaio.id, uid)
    setSelectedEnsaio({
      ...selectedEnsaio,
      presencas: presente ? (selectedEnsaio.presencas ?? []).filter(u => u !== uid) : [...(selectedEnsaio.presencas ?? []), uid],
    })
  }

  async function handleSaveEnsaioRegistro() {
    if (!selectedEnsaio || !currentUser) return
    setSavingEnsaioRegistro(true)
    try {
      const duracaoSegundos = (parseInt(ensaioRegistroDuracaoDraft, 10) || 0) * 60
      await salvarRegistroEnsaio(selectedEnsaio.id, { anotacoes: ensaioRegistroAnotacoesDraft, duracaoSegundos }, currentUser.uid)
      setSelectedEnsaio({
        ...selectedEnsaio,
        anotacoes: ensaioRegistroAnotacoesDraft.trim() || undefined,
        duracaoSegundos,
        finalizadoByUid: currentUser.uid,
        finalizadoAt: new Date().toISOString(),
      })
    } finally {
      setSavingEnsaioRegistro(false)
    }
  }

  function openFigurinoUploadModal() {
    setFigurinoUploadEscopo('geral')
    setFigurinoUploadPersonagemId('')
    setFigurinoError('')
    setFigurinoUploadModalOpen(true)
  }

  async function handleUploadFigurino(fileList: FileList | null) {
    if (!fileList || !cena || !currentUser) return
    const personagemId = figurinoUploadEscopo === 'personagem' ? figurinoUploadPersonagemId || undefined : undefined
    const files = Array.from(fileList)
    setFigurinoError('')
    setUploadingFigurino(true)
    try {
      const novos: FigurinoImagem[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          setFigurinoError('Só imagens são aceitas.')
          continue
        }
        if (file.size > FIGURINO_MAX_BYTES) {
          setFigurinoError('Cada imagem precisa ter até 5MB.')
          continue
        }
        const uploaded = await uploadCenaFile(cena.id, 'figurino', file)
        novos.push({
          id: uploaded.id,
          url: uploaded.url,
          path: uploaded.path,
          personagemId,
          uploadedByUid: currentUser.uid,
          uploadedAt: new Date().toISOString(),
        })
      }
      if (novos.length) {
        await updateCenaFigurinos(cena.id, [...(cena.figurinos ?? []), ...novos], currentUser.uid)
        setFigurinoUploadModalOpen(false)
      }
    } catch {
      setFigurinoError('Não foi possível enviar. Tente de novo.')
    } finally {
      setUploadingFigurino(false)
    }
  }

  async function handleDeleteFigurino(item: FigurinoImagem) {
    if (!cena || !currentUser) return
    setUploadingFigurino(true)
    try {
      await updateCenaFigurinos(cena.id, (cena.figurinos ?? []).filter(f => f.id !== item.id), currentUser.uid)
      await deleteCenaFile(item.path)
      setFigurinoDeleteTarget(null)
      setFigurinoViewerIndex(null)
    } finally {
      setUploadingFigurino(false)
    }
  }

  async function handleUploadMusica(fileList: FileList | null) {
    if (!fileList || !cena || !currentUser) return
    const files = Array.from(fileList)
    setMusicaError('')
    setUploadingMusica(true)
    try {
      const novas: Musica[] = []
      for (const file of files) {
        if (!file.type.startsWith('audio/')) {
          setMusicaError('Só arquivos de áudio são aceitos.')
          continue
        }
        if (file.size > MUSICA_MAX_BYTES) {
          setMusicaError('Cada música precisa ter até 15MB.')
          continue
        }
        const uploaded = await uploadCenaFile(cena.id, 'musicas', file)
        novas.push({
          id: uploaded.id,
          nome: file.name.replace(/\.[^.]+$/, ''),
          url: uploaded.url,
          path: uploaded.path,
          uploadedByUid: currentUser.uid,
          uploadedAt: new Date().toISOString(),
        })
      }
      if (novas.length) {
        await updateCenaMusicas(cena.id, [...(cena.musicas ?? []), ...novas], currentUser.uid)
      }
    } catch {
      setMusicaError('Não foi possível enviar. Tente de novo.')
    } finally {
      setUploadingMusica(false)
    }
  }

  async function handleDeleteMusica(item: Musica) {
    if (!cena || !currentUser) return
    setUploadingMusica(true)
    try {
      await updateCenaMusicas(cena.id, (cena.musicas ?? []).filter(m => m.id !== item.id), currentUser.uid)
      await deleteCenaFile(item.path)
      setMusicaDeleteTarget(null)
    } finally {
      setUploadingMusica(false)
    }
  }

  function openMusicaRename(item: Musica) {
    setMusicaRenameDraft(item.nome)
    setMusicaRenameTarget(item)
  }

  async function handleSaveMusicaRename() {
    if (!cena || !currentUser || !musicaRenameTarget) return
    const nome = musicaRenameDraft.trim()
    if (!nome) return
    setSavingMusicaRename(true)
    try {
      const novaLista = (cena.musicas ?? []).map(m => (m.id === musicaRenameTarget.id ? { ...m, nome } : m))
      await updateCenaMusicas(cena.id, novaLista, currentUser.uid)
      setMusicaRenameTarget(null)
    } finally {
      setSavingMusicaRename(false)
    }
  }

  async function handleTrocarMusica(item: Musica, file: File) {
    if (!cena || !currentUser) return
    setMusicaError('')
    if (!file.type.startsWith('audio/')) {
      setMusicaError('Só arquivos de áudio são aceitos.')
      return
    }
    if (file.size > MUSICA_MAX_BYTES) {
      setMusicaError('Cada música precisa ter até 15MB.')
      return
    }
    setUploadingMusica(true)
    try {
      const uploaded = await uploadCenaFile(cena.id, 'musicas', file)
      const novaLista = (cena.musicas ?? []).map(m =>
        m.id === item.id
          ? { ...m, url: uploaded.url, path: uploaded.path, uploadedByUid: currentUser.uid, uploadedAt: new Date().toISOString() }
          : m,
      )
      await updateCenaMusicas(cena.id, novaLista, currentUser.uid)
      await deleteCenaFile(item.path)
    } catch {
      setMusicaError('Não foi possível trocar. Tente de novo.')
    } finally {
      setUploadingMusica(false)
      setTrocandoMusicaId(null)
    }
  }

  async function handleSaveObrigatorios() {
    if (!selectedEnsaio) return
    setSavingObrigatorios(true)
    try {
      await updateEnsaioObrigatorios(selectedEnsaio.id, obrigatoriosDraft)
      setSelectedEnsaio({ ...selectedEnsaio, obrigatorios: obrigatoriosDraft })
    } finally {
      setSavingObrigatorios(false)
    }
  }

  async function handleSaveHorario() {
    if (!selectedEnsaio || !horarioDraft) return
    setSavingHorario(true)
    try {
      await updateEnsaioHorario(selectedEnsaio.id, horarioDraft)
      setSelectedEnsaio({ ...selectedEnsaio, horario: horarioDraft })
    } finally {
      setSavingHorario(false)
    }
  }

  async function handleSaveFlags() {
    if (!selectedEnsaio) return
    setSavingFlags(true)
    try {
      await updateEnsaioFlags(selectedEnsaio.id, { geral: geralDraft, comFigurino: comFigurinoDraft })
      setSelectedEnsaio({ ...selectedEnsaio, geral: geralDraft, comFigurino: comFigurinoDraft })
    } finally {
      setSavingFlags(false)
    }
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
                      <Button variant="ghost" size="icon" onClick={openAgendaModal} title="Editar agenda">
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                    const jaConfirmou = !!currentUser && !!e.presencas?.includes(currentUser.uid)
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
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', jaConfirmou ? 'bg-emerald-500' : 'bg-gray-300')} />
                          <span className={cn('flex-1 truncate', !jaConfirmou && 'text-gray-400')}>
                            {formatRelativeDia(e.data, todayKey)} · {formatHoraCompacta(e.horario)}
                          </span>
                          {jaConfirmou && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
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
                            onClick={() => {
                              if (ensaio) openSelectedEnsaio(ensaio)
                              else if (occurrence) openConfirmModal()
                              else openCreateEnsaioModal(date)
                            }}
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

              {!personagensOpen && cena.personagens.length > 0 && (
                <AvatarStack
                  items={personagensOrdenados.map(p => ({
                    key: p.id,
                    photoURL: p.participanteUid ? users[p.participanteUid]?.photoURL : undefined,
                    name: p.nome,
                  }))}
                  className="mt-2"
                />
              )}

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
                            {p.participanteUid && <p className="text-xs text-gray-500 truncate">{nameFor(p.participanteUid)}</p>}
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

          <Card>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-base font-semibold">
                  <Music className="h-4 w-4 text-primary" />
                  Músicas
                </p>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => musicaInputRef.current?.click()}
                    disabled={uploadingMusica}
                    title="Adicionar música"
                  >
                    {uploadingMusica ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <input
                ref={musicaInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={e => {
                  handleUploadMusica(e.target.files)
                  e.target.value = ''
                }}
              />
              <input
                ref={trocarMusicaInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  const item = cena.musicas?.find(m => m.id === trocandoMusicaId)
                  if (file && item) handleTrocarMusica(item, file)
                  e.target.value = ''
                }}
              />
              {musicaError && <p className="text-xs text-red-600">{musicaError}</p>}
              {!cena.musicas?.length ? (
                <p className="text-xs text-muted-foreground py-1">Nenhuma música ainda.</p>
              ) : (
                <div className="space-y-2.5">
                  {cena.musicas.map(m => (
                    <div key={m.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{m.nome}</p>
                        {isAdmin && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openMusicaRename(m)}
                              disabled={uploadingMusica}
                              title="Renomear"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setTrocandoMusicaId(m.id)
                                trocarMusicaInputRef.current?.click()
                              }}
                              disabled={uploadingMusica}
                              title="Trocar arquivo"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMusicaDeleteTarget(m)}
                              disabled={uploadingMusica}
                              title="Excluir"
                              className="text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <audio controls src={m.url} className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                          onClick={() => openSelectedEnsaio(e)}
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

          <Button className="w-full gap-1.5" onClick={() => navigate(`/cenas/${cena.id}/iniciar-ensaio`)}>
            <Play className="h-4 w-4" />
            Iniciar ensaio
          </Button>

          <Card>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-base font-semibold">
                  <Image className="h-4 w-4 text-primary" />
                  Ideias de figurinos
                </p>
                {canManageAgenda && (
                  <Button variant="ghost" size="icon" onClick={openFigurinoUploadModal} title="Adicionar foto">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <input
                ref={figurinoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => {
                  handleUploadFigurino(e.target.files)
                  e.target.value = ''
                }}
              />
              {!cena.figurinos?.length ? (
                <p className="text-xs text-muted-foreground py-1">Sem ideias ainda.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {figurinosOrdenados.map((f, index) => {
                    const personagemNome = f.personagemId ? cena.personagens.find(p => p.id === f.personagemId)?.nome : undefined
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFigurinoViewerIndex(index)}
                        className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                      >
                        <img src={f.url} alt="" className="h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                          {personagemNome ?? 'Geral'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

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
                {canManageAgenda && (
                  <Button variant="ghost" size="icon" onClick={openAddParticipanteModal} className="shrink-0" title="Adicionar participante">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {!participantesOpen && (outrosParticipantes.length > 0 || cena.liderUid) && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <AvatarStack
                    items={outrosParticipantes.map(uid => ({ key: uid, photoURL: users[uid]?.photoURL, name: nameFor(uid) }))}
                    className="flex-1"
                  />
                  {cena.liderUid && (
                    <button
                      type="button"
                      title={`Líder: ${nameFor(cena.liderUid)}`}
                      className="relative shrink-0"
                      onClick={() => setLiderModalOpen(true)}
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
                      <button type="button" onClick={() => setLiderModalOpen(true)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5">
                        <div className="relative shrink-0">
                          <Avatar photoURL={users[cena.liderUid]?.photoURL} name={nameFor(cena.liderUid)} className="h-9 w-9 text-xs" />
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
                            <Crown className="h-2.5 w-2.5 text-white" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-medium truncate">{nameFor(cena.liderUid)}</p>
                          <p className="text-xs text-amber-600">Líder</p>
                        </div>
                      </button>
                    )}
                    {outrosParticipantes.map(uid => (
                      <div key={uid} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                        <Avatar photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-9 w-9 text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{nameFor(uid)}</p>
                        </div>
                        {canManageAgenda && (
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-2">Nenhum participante cadastrado ainda.</p>
                ))}
            </CardContent>
          </Card>
        </>
      )}

      {cena?.liderUid && (
        <Dialog
          open={liderModalOpen}
          onClose={() => setLiderModalOpen(false)}
          title={
            <span className="flex items-center gap-2.5">
              <Avatar photoURL={users[cena.liderUid]?.photoURL} name={nameFor(cena.liderUid)} className="h-9 w-9 text-sm" />
              {nameFor(cena.liderUid)}
            </span>
          }
        >
          {(() => {
            const liderInscricao = inscricoesByUid[cena.liderUid]
            return (
              <div className="divide-y divide-gray-100">
                <div className="py-3 first:pt-0">
                  <p className="text-sm text-muted-foreground">Papel</p>
                  <p className="text-base">Líder da cena</p>
                </div>
                {liderInscricao?.telefone && (
                  <div className="py-3">
                    <p className="text-sm text-muted-foreground">Telefone (WhatsApp)</p>
                    <a
                      href={whatsappLink(liderInscricao.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-base text-primary hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {liderInscricao.telefone}
                    </a>
                  </div>
                )}
                {liderInscricao?.email && (
                  <div className="py-3">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-base">{liderInscricao.email}</p>
                  </div>
                )}
                {!liderInscricao && (
                  <p className="py-3 text-sm text-muted-foreground">Sem dados de contato cadastrados.</p>
                )}
              </div>
            )
          })()}
        </Dialog>
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
              <Select id="cena-lider" value={liderUidDraft} onChange={e => setLiderUidDraft(e.target.value)}>
                <option value="">Sem líder definido</option>
                {cena.participantes.map(uid => (
                  <option key={uid} value={uid}>
                    {nameFor(uid)}
                  </option>
                ))}
              </Select>
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
              <Select
                id="personagem-participante"
                value={personagemParticipanteDraft}
                onChange={e => setPersonagemParticipanteDraft(e.target.value)}
              >
                <option value="">Sem participante</option>
                {cena.participantes.map(uid => (
                  <option key={uid} value={uid}>
                    {nameFor(uid)}
                  </option>
                ))}
              </Select>
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
                Excluir personagem
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
              <Select id="participante-add" value={participanteAddUid} onChange={e => setParticipanteAddUid(e.target.value)}>
                <option value="">Selecione</option>
                {availableParaAdicionar.map(i => (
                  <option key={i.uid} value={i.uid}>
                    {i.apelido || i.nomeCompleto}
                  </option>
                ))}
              </Select>
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
                    {confirmado && (
                      <Button variant="ghost" size="icon" onClick={() => handleUnconfirm(confirmado)} disabled={savingConfirm} title="Cancelar">
                        <X className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                  </div>

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

      {cena && (
        <Dialog open={createEnsaioModalOpen} onClose={() => setCreateEnsaioModalOpen(false)} title="Novo ensaio">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">
                {createEnsaioDateKey &&
                  new Date(`${createEnsaioDateKey}T00:00:00`).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
              </p>
            </div>

            <div>
              <Label htmlFor="create-ensaio-horario">Horário</Label>
              <Input
                id="create-ensaio-horario"
                type="time"
                value={createEnsaioHorarioDraft}
                onChange={e => setCreateEnsaioHorarioDraft(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCreateEnsaioGeralDraft(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  createEnsaioGeralDraft ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
                )}
              >
                <Star className="h-3.5 w-3.5" />
                Ensaio geral
              </button>
              <button
                type="button"
                onClick={() => setCreateEnsaioComFigurinoDraft(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  createEnsaioComFigurinoDraft ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
                )}
              >
                <Shirt className="h-3.5 w-3.5" />
                Com figurino
              </button>
            </div>

            {cena.personagens.length > 0 && (
              <div>
                <Label>Personagens obrigatórios (opcional)</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      toggleAllObrigatorios(cena.personagens.map(p => p.id), createEnsaioObrigatoriosDraft, setCreateEnsaioObrigatoriosDraft)
                    }
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                      cena.personagens.every(p => createEnsaioObrigatoriosDraft.includes(p.id))
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
                      onClick={() => toggleObrigatorio(p.id, createEnsaioObrigatoriosDraft, setCreateEnsaioObrigatoriosDraft)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        createEnsaioObrigatoriosDraft.includes(p.id)
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

            {createEnsaioError && <p className="text-sm text-red-600">{createEnsaioError}</p>}

            <Button className="w-full" onClick={handleCreateEnsaio} disabled={savingCreateEnsaio}>
              {savingCreateEnsaio && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Criar ensaio
            </Button>
          </div>
        </Dialog>
      )}

      <Dialog
        open={!!selectedEnsaio}
        onClose={() => setSelectedEnsaio(null)}
        title={selectedEnsaio?.finalizadoAt ? 'Registro do ensaio' : 'Ensaio'}
      >
        {selectedEnsaio && (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold">
                {new Date(`${selectedEnsaio.data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
              {canManageAgenda && !selectedEnsaio.canceledByUid ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <Input
                    type="time"
                    value={horarioDraft}
                    onChange={e => setHorarioDraft(e.target.value)}
                    className="h-8 w-28 text-sm"
                  />
                  {horarioDraft && horarioDraft !== selectedEnsaio.horario && (
                    <Button size="sm" onClick={handleSaveHorario} disabled={savingHorario}>
                      {savingHorario && <Spinner size="sm" className="border-white/40 border-t-white" />}
                      Salvar
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{selectedEnsaio.horario}</p>
              )}
            </div>

            {!selectedEnsaio.canceledByUid &&
              (canManageAgenda ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGeralDraft(v => !v)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        geralDraft ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
                      )}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Ensaio geral
                    </button>
                    <button
                      type="button"
                      onClick={() => setComFigurinoDraft(v => !v)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        comFigurinoDraft ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
                      )}
                    >
                      <Shirt className="h-3.5 w-3.5" />
                      Com figurino
                    </button>
                  </div>
                  {(geralDraft !== !!selectedEnsaio.geral || comFigurinoDraft !== !!selectedEnsaio.comFigurino) && (
                    <Button size="sm" onClick={handleSaveFlags} disabled={savingFlags}>
                      {savingFlags && <Spinner size="sm" className="border-white/40 border-t-white" />}
                      Salvar
                    </Button>
                  )}
                </div>
              ) : (
                (selectedEnsaio.geral || selectedEnsaio.comFigurino) && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEnsaio.geral && (
                      <Badge variant="outline" className="gap-1.5 text-xs">
                        <Star className="h-3.5 w-3.5" />
                        Ensaio geral
                      </Badge>
                    )}
                    {selectedEnsaio.comFigurino && (
                      <Badge variant="outline" className="gap-1.5 text-xs">
                        <Shirt className="h-3.5 w-3.5" />
                        Com figurino
                      </Badge>
                    )}
                  </div>
                )
              ))}

            {selectedEnsaio.canceledByUid ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-red-50 px-3 py-2.5">
                <Avatar
                  photoURL={users[selectedEnsaio.canceledByUid]?.photoURL}
                  name={nameFor(selectedEnsaio.canceledByUid)}
                  className="h-9 w-9 text-xs"
                />
                <div>
                  <p className="text-sm font-medium text-red-700">Ensaio cancelado</p>
                  <p className="text-xs text-red-600">por {nameFor(selectedEnsaio.canceledByUid)}</p>
                </div>
              </div>
            ) : (
              cena &&
              (() => {
                const elenco = cena.personagens.filter(p => p.participanteUid)
                return (
                  <div>
                    <p className="text-sm font-medium mb-1.5">
                      {canManageAgenda ? 'Presença' : 'Confirmados'} ({selectedEnsaio.presencas?.length ?? 0}/{elenco.length})
                    </p>
                    {elenco.length ? (
                      <div className="space-y-1">
                        {elenco.map(p => {
                          const confirmado = !!selectedEnsaio.presencas?.includes(p.participanteUid!)
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={!canManageAgenda}
                              onClick={() => toggleSelectedPresenca(p.participanteUid!)}
                              className={cn(
                                'flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left disabled:cursor-default',
                                canManageAgenda && 'hover:bg-gray-50',
                              )}
                            >
                              <div className="relative shrink-0">
                                <Avatar
                                  photoURL={users[p.participanteUid!]?.photoURL}
                                  name={p.nome}
                                  className={cn('h-8 w-8 text-xs', confirmado && 'ring-2 ring-emerald-500')}
                                />
                                {confirmado && (
                                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                                    <Check className="h-2 w-2 text-white" />
                                  </span>
                                )}
                              </div>
                              <p className="text-sm truncate flex-1">{p.nome}</p>
                              {canManageAgenda && (
                                <span className="text-xs text-muted-foreground">{confirmado ? 'presente' : 'ausente'}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum personagem com participante vinculado ainda.</p>
                    )}
                  </div>
                )
              })()
            )}

            {!canManageAgenda && selectedEnsaio.finalizadoAt && (
              <div className="space-y-1.5 rounded-lg border border-gray-200 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <NotebookPen className="h-4 w-4 text-primary" />
                  Anotações do ensaio
                </p>
                {selectedEnsaio.duracaoSegundos !== undefined && (
                  <p className="text-xs text-muted-foreground">Duração: {formatDuracao(selectedEnsaio.duracaoSegundos)}</p>
                )}
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {selectedEnsaio.anotacoes || 'Nenhuma anotação registrada.'}
                </p>
              </div>
            )}

            {canManageAgenda && !selectedEnsaio.canceledByUid && (
              <div className="space-y-2.5 rounded-lg border border-gray-200 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <NotebookPen className="h-4 w-4 text-primary" />
                  Registro do ensaio
                </p>
                <div>
                  <Label htmlFor="ensaio-registro-duracao">Duração (minutos)</Label>
                  <Input
                    id="ensaio-registro-duracao"
                    type="number"
                    min={0}
                    value={ensaioRegistroDuracaoDraft}
                    onChange={e => setEnsaioRegistroDuracaoDraft(e.target.value)}
                    placeholder="Ex.: 90"
                  />
                </div>
                <div>
                  <Label htmlFor="ensaio-registro-anotacoes">Anotações</Label>
                  <Textarea
                    id="ensaio-registro-anotacoes"
                    value={ensaioRegistroAnotacoesDraft}
                    onChange={e => setEnsaioRegistroAnotacoesDraft(e.target.value)}
                    className="mt-1.5"
                    placeholder="Ex.: revisar a coreografia do duelo, testar troca de figurino..."
                  />
                </div>
                {(ensaioRegistroAnotacoesDraft !== (selectedEnsaio.anotacoes ?? '') ||
                  ensaioRegistroDuracaoDraft !==
                    (selectedEnsaio.duracaoSegundos !== undefined ? String(Math.round(selectedEnsaio.duracaoSegundos / 60)) : '')) && (
                  <Button size="sm" onClick={handleSaveEnsaioRegistro} disabled={savingEnsaioRegistro}>
                    {savingEnsaioRegistro && <Spinner size="sm" className="border-white/40 border-t-white" />}
                    Salvar registro
                  </Button>
                )}
                {selectedEnsaio.finalizadoAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Última atualização por {nameFor(selectedEnsaio.finalizadoByUid!)}
                  </p>
                )}
              </div>
            )}

            {!selectedEnsaio.canceledByUid && !!cena?.personagens.length && (
              <div>
                <p className="text-sm font-medium mb-1.5">Personagens obrigatórios</p>
                {canManageAgenda ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleAllObrigatorios(cena.personagens.map(p => p.id), obrigatoriosDraft, setObrigatoriosDraft)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                          cena.personagens.every(p => obrigatoriosDraft.includes(p.id))
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
                          onClick={() => toggleObrigatorio(p.id, obrigatoriosDraft, setObrigatoriosDraft)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            obrigatoriosDraft.includes(p.id)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-gray-300 bg-white text-gray-600',
                          )}
                        >
                          {p.nome}
                        </button>
                      ))}
                    </div>
                    {JSON.stringify([...obrigatoriosDraft].sort()) !== JSON.stringify([...(selectedEnsaio.obrigatorios ?? [])].sort()) && (
                      <Button size="sm" onClick={handleSaveObrigatorios} disabled={savingObrigatorios}>
                        {savingObrigatorios && <Spinner size="sm" className="border-white/40 border-t-white" />}
                        Salvar obrigatórios
                      </Button>
                    )}
                  </div>
                ) : selectedEnsaio.obrigatorios?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEnsaio.obrigatorios.map(pid => {
                      const p = cena?.personagens.find(cp => cp.id === pid)
                      return p ? (
                        <Badge key={pid} variant="outline" className="text-xs">
                          {p.nome}
                        </Badge>
                      ) : null
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum personagem marcado como obrigatório.</p>
                )}
              </div>
            )}

            {canManageAgenda &&
              (selectedEnsaio.canceledByUid ? (
                <Button className="w-full" onClick={handleReconfirmSelectedEnsaio} disabled={cancelingEnsaio}>
                  {cancelingEnsaio && <Spinner size="sm" className="border-white/40 border-t-white" />}
                  Reconfirmar ensaio
                </Button>
              ) : (
                <Button variant="destructive" className="w-full" onClick={handleCancelSelectedEnsaio} disabled={cancelingEnsaio}>
                  {cancelingEnsaio && <Spinner size="sm" className="border-white/40 border-t-white" />}
                  Cancelar ensaio
                </Button>
              ))}

            {!selectedEnsaio.canceledByUid && myPersonagem && (
              (() => {
                const jaConfirmou = !!currentUser && !!selectedEnsaio.presencas?.includes(currentUser.uid)
                const podeConfirmar = !jaConfirmou && canCheckin(selectedEnsaio.data, selectedEnsaio.horario, checkinLimiteHoras)
                if (jaConfirmou) {
                  return (
                    <p className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700">
                      <Check className="h-4 w-4" />
                      Presença confirmada
                    </p>
                  )
                }
                if (podeConfirmar) {
                  return (
                    <Button
                      className="w-full"
                      onClick={() => handleConfirmPresenca(selectedEnsaio)}
                      disabled={confirmingPresenca}
                    >
                      {confirmingPresenca && <Spinner size="sm" className="border-white/40 border-t-white" />}
                      Confirmar presença
                    </Button>
                  )
                }
                return (
                  <p className="text-xs text-muted-foreground text-center">
                    O check-in abre no dia do ensaio, até {checkinLimiteHoras}h antes do horário.
                  </p>
                )
              })()
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={figurinoUploadModalOpen} onClose={() => setFigurinoUploadModalOpen(false)} title="Adicionar figurino">
        <div className="space-y-4">
          <div>
            <Label>Essa foto é</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setFigurinoUploadEscopo('geral')}
                className={cn(
                  'rounded-lg border py-2 text-sm font-medium transition-colors',
                  figurinoUploadEscopo === 'geral' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                )}
              >
                Geral
              </button>
              <button
                type="button"
                onClick={() => setFigurinoUploadEscopo('personagem')}
                className={cn(
                  'rounded-lg border py-2 text-sm font-medium transition-colors',
                  figurinoUploadEscopo === 'personagem'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 bg-white text-gray-700',
                )}
              >
                De um personagem
              </button>
            </div>
          </div>

          {figurinoUploadEscopo === 'personagem' && (
            <div>
              <Label htmlFor="figurino-personagem">Personagem</Label>
              <Select
                id="figurino-personagem"
                value={figurinoUploadPersonagemId}
                onChange={e => setFigurinoUploadPersonagemId(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Selecione um personagem</option>
                {personagensOrdenados.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {figurinoError && <p className="text-sm text-red-600">{figurinoError}</p>}

          <Button
            className="w-full gap-1.5"
            onClick={() => figurinoInputRef.current?.click()}
            disabled={uploadingFigurino || (figurinoUploadEscopo === 'personagem' && !figurinoUploadPersonagemId)}
          >
            {uploadingFigurino && <Spinner size="sm" className="border-white/40 border-t-white" />}
            Escolher fotos
          </Button>
        </div>
      </Dialog>

      <Dialog open={figurinoViewerIndex !== null} onClose={() => setFigurinoViewerIndex(null)} title="Figurino">
        {figurinoViewerIndex !== null &&
          figurinosOrdenados[figurinoViewerIndex] &&
          (() => {
            const item = figurinosOrdenados[figurinoViewerIndex]
            const personagemNome = item.personagemId ? cena?.personagens.find(p => p.id === item.personagemId)?.nome : undefined
            return (
              <div className="space-y-3">
                <div className="relative">
                  <img src={item.url} alt="" className="w-full rounded-lg" />
                  {figurinoViewerIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setFigurinoViewerIndex(i => (i ?? 0) - 1)}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                      title="Anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  {figurinoViewerIndex < figurinosOrdenados.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setFigurinoViewerIndex(i => (i ?? 0) + 1)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                      title="Próxima"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{personagemNome ?? 'Geral'}</span>
                  <span>
                    {figurinoViewerIndex + 1}/{figurinosOrdenados.length}
                  </span>
                </div>
                {canManageAgenda && (
                  <Button variant="destructive" className="w-full gap-1.5" onClick={() => setFigurinoDeleteTarget(item)}>
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                )}
              </div>
            )
          })()}
      </Dialog>

      <Dialog open={!!figurinoDeleteTarget} onClose={() => setFigurinoDeleteTarget(null)} title="Excluir foto">
        {figurinoDeleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Excluir essa foto de figurino? Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setFigurinoDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleDeleteFigurino(figurinoDeleteTarget)}
                disabled={uploadingFigurino}
              >
                {uploadingFigurino && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Excluir
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!musicaDeleteTarget} onClose={() => setMusicaDeleteTarget(null)} title="Excluir música">
        {musicaDeleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Excluir <span className="font-medium">{musicaDeleteTarget.nome}</span>? Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMusicaDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleDeleteMusica(musicaDeleteTarget)}
                disabled={uploadingMusica}
              >
                {uploadingMusica && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Excluir
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!musicaRenameTarget} onClose={() => setMusicaRenameTarget(null)} title="Renomear música">
        {musicaRenameTarget && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="musica-rename">Nome</Label>
              <Input id="musica-rename" value={musicaRenameDraft} onChange={e => setMusicaRenameDraft(e.target.value)} autoFocus />
            </div>
            <Button className="w-full" onClick={handleSaveMusicaRename} disabled={savingMusicaRename || !musicaRenameDraft.trim()}>
              {savingMusicaRename && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  )
}
