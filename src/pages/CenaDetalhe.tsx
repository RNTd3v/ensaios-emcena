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
  MessageCircle,
  Pencil,
  Play,
  Plus,
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
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers, updateUserRole } from '@/services/firebase/auth'
import {
  subscribeToCena,
  updateCenaAgenda,
  updateCenaLider,
  updateCenaNome,
  updateCenaParticipantes,
  updateCenaPersonagens,
  updateCenaRoteiro,
} from '@/services/firebase/cenas'
import {
  cancelarEnsaio,
  confirmarPresenca,
  createEnsaio,
  reconfirmarEnsaio,
  subscribeToEnsaiosDaCena,
  updateEnsaioFlags,
  updateEnsaioHorario,
  updateEnsaioObrigatorios,
} from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { DIA_SEMANA_LABELS, type AppUser, type Cena, type DiaSemana, type Ensaio, type Inscricao, type Personagem } from '@/types'
import { DIAS_ORDER, sortDias } from '@/lib/dias'
import { formatHoraCompacta, horarioDoDia } from '@/lib/cenaHorario'
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

  const canManageAgenda = isAdmin || (!!cena && cena.liderUid === currentUser?.uid)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [liderModalOpen, setLiderModalOpen] = useState(false)
  const [nomeDraft, setNomeDraft] = useState('')
  const [liderUidDraft, setLiderUidDraft] = useState('')
  const [roteiroReferenciaDraft, setRoteiroReferenciaDraft] = useState('')
  const [roteiroUrlDraft, setRoteiroUrlDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [agendaOpen, setAgendaOpen] = useState(true)
  const [personagensOpen, setPersonagensOpen] = useState(false)
  const [personagemModalOpen, setPersonagemModalOpen] = useState(false)
  const [editingPersonagemId, setEditingPersonagemId] = useState<string | null>(null)
  const [personagemNomeDraft, setPersonagemNomeDraft] = useState('')
  const [personagemParticipanteDraft, setPersonagemParticipanteDraft] = useState('')
  const [personagensBase, setPersonagensBase] = useState<Personagem[]>([])
  const [savingPersonagem, setSavingPersonagem] = useState(false)
  const [personagemError, setPersonagemError] = useState('')

  const [participantesOpen, setParticipantesOpen] = useState(false)
  const [participanteModalOpen, setParticipanteModalOpen] = useState(false)
  const [participanteAddUid, setParticipanteAddUid] = useState('')
  const [savingParticipante, setSavingParticipante] = useState(false)
  const [participanteError, setParticipanteError] = useState('')
  const personagemNomeInputRef = useRef<HTMLInputElement>(null)

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

  const availableParaAdicionar = useMemo(
    () =>
      (inscricoes ?? [])
        .filter(i => !cena?.participantes.includes(i.uid))
        .filter(i => i.areas.some(a => a === 'elenco' || a === 'tecnica'))
        .filter(i => !cena?.dias.length || cena.dias.every(d => i.disponibilidade.dias.includes(d)))
        .sort((a, b) => (a.apelido || a.nomeCompleto).localeCompare(b.apelido || b.nomeCompleto)),
    [inscricoes, cena?.participantes, cena?.dias],
  )

  function openEditModal() {
    if (!cena) return
    setNomeDraft(cena.nome)
    setLiderUidDraft(cena.liderUid ?? '')
    setRoteiroReferenciaDraft(cena.roteiroReferencia ?? '')
    setRoteiroUrlDraft(cena.roteiroUrl ?? '')
    setEditError('')
    setEditModalOpen(true)
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
      await Promise.all([
        nome !== cena.nome ? updateCenaNome(cena.id, nome, currentUser.uid) : Promise.resolve(),
        liderUidDraft !== (cena.liderUid ?? '') ? updateCenaLider(cena.id, liderUidDraft || undefined, currentUser.uid) : Promise.resolve(),
        updateCenaRoteiro(cena.id, { referencia: roteiroReferenciaDraft.trim() || undefined, url: url || undefined }, currentUser.uid),
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
    setPersonagemNomeDraft('')
    setPersonagemParticipanteDraft('')
    setPersonagemError('')
    setPersonagensBase(cena?.personagens ?? [])
    setPersonagemModalOpen(true)
  }

  function openEditPersonagem(p: Personagem) {
    setEditingPersonagemId(p.id)
    setPersonagemNomeDraft(p.nome)
    setPersonagemParticipanteDraft(p.participanteUid ?? '')
    setPersonagemError('')
    setPersonagensBase(cena?.personagens ?? [])
    setPersonagemModalOpen(true)
  }

  /**
   * `keepOpen` é o "cadastro em lote": salva e deixa o modal aberto pra adicionar o próximo. Usa
   * `personagensBase` (atualizado a cada save) em vez de `cena.personagens` porque o snapshot do
   * Firestore ainda não voltou entre um clique e outro — se lesse de `cena` de novo, perderia o
   * personagem que acabou de salvar.
   */
  async function handleSavePersonagem(keepOpen: boolean) {
    if (!cena || !currentUser) return
    const nome = personagemNomeDraft.trim()
    if (!nome) {
      setPersonagemError('Preencha o nome do personagem.')
      return
    }
    setSavingPersonagem(true)
    setPersonagemError('')
    try {
      const participanteUid = personagemParticipanteDraft || undefined
      const next = editingPersonagemId
        ? personagensBase.map(p => (p.id === editingPersonagemId ? { ...p, nome, participanteUid } : p))
        : [...personagensBase, { id: crypto.randomUUID(), nome, participanteUid }]
      await updateCenaPersonagens(cena.id, next, currentUser.uid)
      setPersonagensBase(next)
      if (keepOpen) {
        setPersonagemNomeDraft('')
        setPersonagemParticipanteDraft('')
        personagemNomeInputRef.current?.focus()
      } else {
        setPersonagemModalOpen(false)
      }
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
    setSelectedEnsaio(ensaio)
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
                        variant="ghost"
                        size="icon"
                        onClick={openConfirmModal}
                        title="Confirmar ensaios da semana"
                        className={cn('text-primary', hasPendingConfirmation && 'bg-primary/10')}
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
                      <button
                        type="button"
                        key={e.id}
                        disabled={!podeConfirmar || confirmingPresenca}
                        onClick={() => handleConfirmPresenca(e)}
                        title={podeConfirmar ? 'Toque pra confirmar presença' : undefined}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left text-sm"
                      >
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', jaConfirmou ? 'bg-emerald-500' : 'bg-gray-300')} />
                        <span className={cn('flex-1 truncate', !jaConfirmou && 'text-gray-400')}>
                          {formatRelativeDia(e.data, todayKey)} · {formatHoraCompacta(e.horario)}
                        </span>
                        {jaConfirmou && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                      </button>
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
                          <button
                            key={dateKey}
                            type="button"
                            disabled={!ensaio && !canManageAgenda}
                            onClick={() => {
                              if (ensaio) openSelectedEnsaio(ensaio)
                              else if (occurrence) openConfirmModal()
                              else openCreateEnsaioModal(date)
                            }}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm',
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
                  items={cena.personagens.map(p => ({
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
                    {cena.personagens.map(p => (
                      <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                        <Avatar
                          photoURL={p.participanteUid ? users[p.participanteUid]?.photoURL : undefined}
                          name={p.nome}
                          className="h-9 w-9 text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.nome}</p>
                          {p.participanteUid && <p className="text-xs text-gray-500 truncate">{nameFor(p.participanteUid)}</p>}
                        </div>
                        {isAdmin ? (
                          <Button variant="ghost" size="icon" onClick={() => openEditPersonagem(p)} className="shrink-0" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Link
                            to={`/cenas/${cena.id}/personagens/${p.id}`}
                            className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Ver detalhes"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-2">Nenhum personagem cadastrado ainda.</p>
                ))}
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

          <Button className="w-full gap-1.5" onClick={() => navigate(`/cenas/${cena.id}/iniciar-ensaio`)}>
            <Play className="h-4 w-4" />
            Iniciar ensaio
          </Button>
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

      <Dialog open={!!selectedEnsaio} onClose={() => setSelectedEnsaio(null)} title="Ensaio">
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
                      Confirmados ({selectedEnsaio.presencas?.length ?? 0}/{elenco.length})
                    </p>
                    {elenco.length ? (
                      <div className="space-y-1">
                        {elenco.map(p => {
                          const confirmado = !!selectedEnsaio.presencas?.includes(p.participanteUid!)
                          return (
                            <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
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
                              <p className="text-sm truncate">{p.nome}</p>
                            </div>
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
    </div>
  )
}
