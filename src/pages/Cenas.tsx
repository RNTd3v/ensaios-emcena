import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Drama,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
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
import { getUsers } from '@/services/firebase/auth'
import {
  createCena,
  deactivateCena,
  deleteCenaPermanently,
  reactivateCena,
  subscribeToCenas,
  updateCena,
  type CenaInput,
} from '@/services/firebase/cenas'
import { subscribeToAllEnsaios, subscribeToEnsaiosDaCena } from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import { DIA_SEMANA_LABELS, type AppUser, type Cena, type DiaSemana, type Ensaio, type Inscricao } from '@/types'
import { DIAS_ORDER, sortDias } from '@/lib/dias'
import { formatHoraCompacta, horarioDoDia } from '@/lib/cenaHorario'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { whatsappLink } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/** Próximo ensaio confirmado dessa cena (qualquer data futura, sem paginação). */
function useProximoEnsaio(cena: Cena) {
  const [ensaios, setEnsaios] = useState<Ensaio[] | null>(null)

  useEffect(() => subscribeToEnsaiosDaCena(cena.id, setEnsaios), [cena.id])

  const todayKey = toDateKey(new Date())
  const proximo = useMemo(() => {
    if (!ensaios) return undefined
    const agora = new Date().toTimeString().slice(0, 5)
    return ensaios
      .filter(e => !e.canceledByUid && (e.data > todayKey || (e.data === todayKey && e.horario >= agora)))
      .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))[0]
  }, [ensaios, todayKey])

  return { ensaios, proximo, todayKey }
}

/** Próximo ensaio confirmado + quantos confirmaram presença, pro card aberto. */
function ProximoEnsaio({ cena }: { cena: Cena }) {
  const { ensaios, proximo, todayKey } = useProximoEnsaio(cena)

  if (!ensaios) return null
  if (!proximo) return <p className="text-xs text-gray-400">Nenhum ensaio confirmado.</p>

  const elencoCount = cena.personagens.filter(p => p.participanteUid).length

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <Clock className="h-3 w-3 text-primary shrink-0" />
      <span className="truncate">
        Próximo: {formatRelativeDia(proximo.data, todayKey)} · {formatHoraCompacta(proximo.horario)}
      </span>
      {elencoCount > 0 && (
        <span className="ml-auto flex shrink-0 items-center gap-1 text-gray-400">
          <Check className="h-3 w-3" />
          {proximo.presencas?.length ?? 0}/{elencoCount}
        </span>
      )}
    </div>
  )
}

/** Chip com o próximo ensaio + status do check-in do usuário logado, pro card fechado. */
function ProximoEnsaioChip({ cena }: { cena: Cena }) {
  const currentUser = useAuthStore(s => s.user)
  const { ensaios, proximo, todayKey } = useProximoEnsaio(cena)

  if (!ensaios || !proximo) return null

  const jaConfirmou = !!currentUser && !!proximo.presencas?.includes(currentUser.uid)

  return (
    <Badge variant="outline" className="w-fit max-w-full gap-1.5 border-gray-200 bg-gray-50 text-[11px] font-normal text-gray-600">
      <span className="truncate">
        Próximo ensaio: {formatRelativeDia(proximo.data, todayKey)} às {formatHoraCompacta(proximo.horario)}
      </span>
      {jaConfirmou ? (
        <span title="Check-in realizado" className="shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        </span>
      ) : (
        <span title="Aguardando check-in" className="shrink-0">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
        </span>
      )}
    </Badge>
  )
}

type OrdenacaoCenas = 'nome-asc' | 'nome-desc' | 'recente' | 'antiga' | 'proximo-ensaio'

const ORDENACAO_STORAGE_KEY = 'cenas-ordenacao'
const ORDENACAO_LABELS: Record<OrdenacaoCenas, string> = {
  'nome-asc': 'Nome (A-Z)',
  'nome-desc': 'Nome (Z-A)',
  recente: 'Mais recentes',
  antiga: 'Mais antigas',
  'proximo-ensaio': 'Próximo ensaio',
}

function loadOrdenacao(): OrdenacaoCenas {
  try {
    const saved = localStorage.getItem(ORDENACAO_STORAGE_KEY)
    if (saved && saved in ORDENACAO_LABELS) return saved as OrdenacaoCenas
  } catch {
    // localStorage indisponível (modo privado etc.) — usa o padrão
  }
  return 'recente'
}

export function Cenas() {
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role === 'admin'
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [search, setSearch] = useState('')

  const [nomeFilter, setNomeFilter] = useState('')
  const [pessoaFilter, setPessoaFilter] = useState('')
  const [diaFilterList, setDiaFilterList] = useState<DiaSemana[]>([])
  const [liderFilter, setLiderFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [ordenacao, setOrdenacao] = useState<OrdenacaoCenas>(loadOrdenacao)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const hasActiveFilters = pessoaFilter.trim() !== '' || diaFilterList.length > 0 || liderFilter !== '' || showInactive

  useEffect(() => {
    try {
      localStorage.setItem(ORDENACAO_STORAGE_KEY, ordenacao)
    } catch {
      // localStorage indisponível (modo privado etc.) — ignora
    }
  }, [ordenacao])

  function toggleCardCollapsed(id: string) {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [participantesUids, setParticipantesUids] = useState<Set<string>>(new Set())
  const [dias, setDias] = useState<DiaSemana[]>([])
  const [horarioMode, setHorarioMode] = useState<'comum' | 'porDia'>('comum')
  const [horarioDraft, setHorarioDraft] = useState('')
  const [horariosPorDiaDraft, setHorariosPorDiaDraft] = useState<Partial<Record<DiaSemana, string>>>({})
  const [personagensRecorrentesSelecionados, setPersonagensRecorrentesSelecionados] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [createdCena, setCreatedCena] = useState<Cena | null>(null)

  const [deactivateTarget, setDeactivateTarget] = useState<Cena | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Cena | null>(null)
  const [liderModalCena, setLiderModalCena] = useState<Cena | null>(null)
  const [hardDeleting, setHardDeleting] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, setCenas)
  }, [currentUser])

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const [ensaiosAll, setEnsaiosAll] = useState<Ensaio[] | null>(null)
  useEffect(() => subscribeToAllEnsaios(setEnsaiosAll), [])

  /** Data+horário do próximo ensaio futuro (não cancelado) de cada cena, pra ordenação "Próximo ensaio". */
  const proximoEnsaioPorCena = useMemo(() => {
    const map = new Map<string, { data: string; horario: string }>()
    if (!ensaiosAll) return map
    const todayKey = toDateKey(new Date())
    const agora = new Date().toTimeString().slice(0, 5)
    for (const e of ensaiosAll) {
      if (e.canceledByUid) continue
      if (!(e.data > todayKey || (e.data === todayKey && e.horario >= agora))) continue
      const atual = map.get(e.cenaId)
      if (!atual || e.data < atual.data || (e.data === atual.data && e.horario < atual.horario)) {
        map.set(e.cenaId, { data: e.data, horario: e.horario })
      }
    }
    return map
  }, [ensaiosAll])

  const inscricoesByUid = useMemo(() => Object.fromEntries((inscricoes ?? []).map(i => [i.uid, i])), [inscricoes])

  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  function toggleDiaFilterList(dia: DiaSemana) {
    setDiaFilterList(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  const lideres = useMemo(() => {
    const uids = new Set((cenas ?? []).map(c => c.liderUid).filter((uid): uid is string => !!uid))
    return [...uids].map(uid => ({ uid, nome: nameFor(uid) })).sort((a, b) => a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' }))
  }, [cenas, inscricoesByUid, users])

  const filteredCenas = useMemo(() => {
    const filtered = (cenas ?? []).filter(cena => {
      if (!showInactive && !cena.ativo) return false
      if (nomeFilter.trim() && !cena.nome.toLowerCase().includes(nomeFilter.trim().toLowerCase())) return false
      if (diaFilterList.length > 0 && !cena.dias.some(d => diaFilterList.includes(d))) return false
      if (liderFilter && cena.liderUid !== liderFilter) return false
      if (pessoaFilter.trim()) {
        const term = pessoaFilter.trim().toLowerCase()
        if (!cena.participantes.some(uid => nameFor(uid).toLowerCase().includes(term))) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      switch (ordenacao) {
        case 'nome-desc':
          return b.nome.localeCompare(a.nome, undefined, { numeric: true, sensitivity: 'base' })
        case 'recente':
          return b.createdAt.localeCompare(a.createdAt)
        case 'antiga':
          return a.createdAt.localeCompare(b.createdAt)
        case 'proximo-ensaio': {
          const pa = proximoEnsaioPorCena.get(a.id)
          const pb = proximoEnsaioPorCena.get(b.id)
          if (!pa && !pb) return 0
          if (!pa) return 1
          if (!pb) return -1
          return pa.data.localeCompare(pb.data) || pa.horario.localeCompare(pb.horario)
        }
        default:
          return a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' })
      }
    })
  }, [cenas, nomeFilter, diaFilterList, liderFilter, pessoaFilter, showInactive, ordenacao, proximoEnsaioPorCena, inscricoesByUid, users])

  const filteredParticipantes = useMemo(() => {
    if (!inscricoes) return []
    const elegiveis = inscricoes.filter(i => {
      if (!i.areas.some(a => a === 'elenco' || a === 'tecnica')) return false
      // Quem já está selecionado continua na lista mesmo sem disponibilidade nos dias atuais,
      // pra não sumir o checkbox e impedir de desmarcar (ex.: depois de trocar os dias da cena).
      if (participantesUids.has(i.uid)) return true
      return dias.length === 0 || dias.every(d => i.disponibilidade.dias.includes(d))
    })
    if (!search.trim()) return elegiveis
    const term = search.toLowerCase()
    return elegiveis.filter(i => i.nomeCompleto.toLowerCase().includes(term) || i.apelido?.toLowerCase().includes(term))
  }, [inscricoes, search, dias, participantesUids])

  function toggleParticipante(uid: string) {
    setParticipantesUids(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function toggleDia(dia: DiaSemana) {
    setDias(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  /**
   * Personagens marcados como recorrentes em outras cenas — pra já incluir na cena nova/editada.
   * Deduplicado por nome: a mesma personagem recorrente em várias cenas aparece uma única vez.
   */
  const personagensRecorrentes = useMemo(() => {
    const nomesJaNaCena = new Set(
      (editingId ? (cenas ?? []).find(c => c.id === editingId)?.personagens : [])?.map(p => p.nome.trim().toLowerCase()) ?? [],
    )
    const porNome = new Map<string, { nome: string; participanteUid?: string }>()
    for (const c of cenas ?? []) {
      if (c.id === editingId) continue
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
  }, [cenas, editingId])

  function togglePersonagemRecorrente(key: string) {
    setPersonagensRecorrentesSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function openCreateModal() {
    setEditingId(null)
    setNome('')
    setParticipantesUids(new Set())
    setDias([])
    setHorarioMode('comum')
    setHorarioDraft('')
    setHorariosPorDiaDraft({})
    setPersonagensRecorrentesSelecionados(new Set())
    setSearch('')
    setFormError('')
    setCreatedCena(null)
    setModalOpen(true)
  }

  function openEditModal(cena: Cena) {
    setEditingId(cena.id)
    setNome(cena.nome)
    setParticipantesUids(new Set(cena.participantes))
    setDias(cena.dias)
    setHorarioMode(cena.horarios ? 'porDia' : 'comum')
    setHorarioDraft(cena.horario ?? '')
    setHorariosPorDiaDraft(cena.horarios ?? {})
    setPersonagensRecorrentesSelecionados(new Set())
    setSearch('')
    setFormError('')
    setCreatedCena(null)
    setModalOpen(true)
  }

  function handleCardClick(cena: Cena) {
    navigate(`/cenas/${cena.id}`)
  }

  async function handleSave() {
    if (!nome.trim() || dias.length === 0 || participantesUids.size === 0) {
      setFormError('Preencha nome, participantes e dia(s).')
      return
    }
    if (!currentUser) return
    setSaving(true)
    setFormError('')
    // Editar preserva os campos que ainda não têm UI completa aqui (líder, observação) — essas
    // "detalhes" são geridas na tela de detalhe da cena. Personagens só ganham entradas novas
    // aqui (os recorrentes escolhidos); editar os já existentes também é lá.
    const editingCena = editingId ? (cenas ?? []).find(c => c.id === editingId) : null
    const stillParticipant = (uid?: string) => !!uid && participantesUids.has(uid)
    const novosPersonagens = [...personagensRecorrentesSelecionados].flatMap(key => {
      const origem = personagensRecorrentes.find(o => o.nome.trim().toLowerCase() === key)
      if (!origem) return []
      return [
        {
          id: crypto.randomUUID(),
          nome: origem.nome,
          recorrente: true,
          participanteUid: stillParticipant(origem.participanteUid) ? origem.participanteUid : undefined,
        },
      ]
    })
    const input: CenaInput = {
      nome: nome.trim(),
      participantes: [...participantesUids],
      liderUid: stillParticipant(editingCena?.liderUid) ? editingCena?.liderUid : undefined,
      personagens: [
        ...(editingCena?.personagens ?? []).map(p => (stillParticipant(p.participanteUid) ? p : { ...p, participanteUid: undefined })),
        ...novosPersonagens,
      ],
      dias,
      horario: horarioMode === 'comum' ? horarioDraft.trim() || undefined : undefined,
      horarios:
        horarioMode === 'porDia'
          ? Object.fromEntries(dias.filter(d => horariosPorDiaDraft[d]).map(d => [d, horariosPorDiaDraft[d] as string]))
          : undefined,
      observacao: editingCena?.observacao,
    }
    try {
      if (editingId) {
        await updateCena(editingId, input, currentUser.uid)
        setModalOpen(false)
      } else {
        const id = await createCena(input, currentUser.uid)
        setCreatedCena({ ...input, id, ativo: true, createdAt: new Date().toISOString() })
      }
    } catch {
      setFormError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  function handleAddDetails() {
    if (!createdCena) return
    navigate(`/cenas/${createdCena.id}`)
  }

  async function handleReactivate(cena: Cena) {
    if (!currentUser) return
    await reactivateCena(cena.id, currentUser.uid)
  }

  async function handleDeactivate() {
    if (!deactivateTarget || !currentUser) return
    setDeactivating(true)
    try {
      await deactivateCena(deactivateTarget.id, currentUser.uid)
      setDeactivateTarget(null)
    } finally {
      setDeactivating(false)
    }
  }

  async function handleHardDelete() {
    if (!hardDeleteTarget) return
    setHardDeleting(true)
    try {
      await deleteCenaPermanently(hardDeleteTarget.id)
      setHardDeleteTarget(null)
    } finally {
      setHardDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white flex-1">Cenas</h1>
        {isAdmin && (
          <Button size="icon" onClick={openCreateModal} title="Nova cena">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Input placeholder="Buscar por nome da cena" value={nomeFilter} onChange={e => setNomeFilter(e.target.value)} className="flex-1" />
        <Button
          variant="outline"
          size="icon"
          title="Filtros"
          onClick={() => setFiltersOpen(true)}
          className="relative border-white/40 bg-white/10 text-white hover:bg-white/20 shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {hasActiveFilters && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-white" />}
        </Button>
      </div>

      {!cenas && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {cenas && cenas.length === 0 && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">Nenhuma cena cadastrada ainda.</CardContent>
        </Card>
      )}

      {cenas && cenas.length > 0 && filteredCenas.length === 0 && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">Nenhuma cena encontrada com esse filtro.</CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filteredCenas.map(cena => {
          const canManage = isAdmin || cena.liderUid === currentUser?.uid
          const isCollapsed = collapsedIds.has(cena.id)
          return (
          <Card
            key={cena.id}
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick(cena)}
            onKeyDown={e => e.key === 'Enter' && handleCardClick(cena)}
            className={cn('p-0 cursor-pointer', !cena.ativo && 'opacity-60')}
          >
            <CardContent className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Drama className="h-4 w-4 shrink-0 text-primary" />
                    <p className="min-w-0 flex-1 truncate text-base font-semibold">{cena.nome}</p>
                    {!cena.ativo && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {!cena.ativo && cena.deactivatedByUid && (
                    <p className="text-[10px] text-gray-400 truncate">Desativado por {nameFor(cena.deactivatedByUid)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cena.ativo ? (
                    canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={e => {
                            e.stopPropagation()
                            openEditModal(cena)
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={e => {
                            e.stopPropagation()
                            setDeactivateTarget(cena)
                          }}
                          title="Desativar"
                          className="text-amber-600"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    )
                  ) : (
                    isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={e => {
                            e.stopPropagation()
                            handleReactivate(cena)
                          }}
                          title="Reativar"
                          className="text-emerald-600"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={e => {
                            e.stopPropagation()
                            setHardDeleteTarget(cena)
                          }}
                          title="Excluir definitivamente"
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => {
                      e.stopPropagation()
                      toggleCardCollapsed(cena.id)
                    }}
                    title={isCollapsed ? 'Expandir' : 'Recolher'}
                  >
                    {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {isCollapsed && <ProximoEnsaioChip cena={cena} />}

              {!isCollapsed && (
                <>
                  <div className="h-px bg-gray-100" />

                  {(() => {
                    const outrosParticipantes = cena.participantes.filter(uid => uid !== cena.liderUid)
                    if (outrosParticipantes.length === 0 && !cena.liderUid) return null
                    return (
                      <div className="flex items-center justify-between gap-2">
                        <AvatarStack
                          items={outrosParticipantes.map(uid => ({ key: uid, photoURL: users[uid]?.photoURL, name: nameFor(uid) }))}
                          className="flex-1"
                        />
                        {cena.liderUid && (
                          <button
                            type="button"
                            className="relative shrink-0"
                            title={`Líder: ${nameFor(cena.liderUid)}`}
                            onClick={e => {
                              e.stopPropagation()
                              setLiderModalCena(cena)
                            }}
                          >
                            <Avatar
                              photoURL={users[cena.liderUid]?.photoURL}
                              name={nameFor(cena.liderUid)}
                              className="h-7 w-7 text-[10px] ring-2 ring-amber-400"
                            />
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
                              <Crown className="h-2.5 w-2.5 text-white" />
                            </span>
                          </button>
                        )}
                      </div>
                    )
                  })()}

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                    {sortDias(cena.dias).map(d => {
                      const horario = horarioDoDia(cena, d)
                      return (
                        <Badge key={d} variant="outline" className="bg-sky-50 border-sky-200 text-sky-700 text-[10px]">
                          {DIA_SEMANA_LABELS[d]}
                          {horario && ` | ${formatHoraCompacta(horario)}`}
                        </Badge>
                      )
                    })}
                  </div>

                  <ProximoEnsaio cena={cena} />

                  {cena.observacao && <p className="text-xs text-gray-500">{cena.observacao}</p>}
                </>
              )}
            </CardContent>
          </Card>
          )
        })}
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="space-y-4">
          <div>
            <Label htmlFor="ordenacao-cenas">Ordenar por</Label>
            <Select
              id="ordenacao-cenas"
              value={ordenacao}
              onChange={e => setOrdenacao(e.target.value as OrdenacaoCenas)}
              className="mt-1.5"
            >
              {(Object.keys(ORDENACAO_LABELS) as OrdenacaoCenas[]).map(key => (
                <option key={key} value={key}>
                  {ORDENACAO_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-pessoa">Pessoa</Label>
            <Input
              id="filtro-pessoa"
              placeholder="Buscar por participante"
              value={pessoaFilter}
              onChange={e => setPessoaFilter(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="filtro-lider">Líder</Label>
            <Select id="filtro-lider" value={liderFilter} onChange={e => setLiderFilter(e.target.value)} className="mt-1.5">
              <option value="">Todos</option>
              {lideres.map(l => (
                <option key={l.uid} value={l.uid}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Dia(s)</Label>
            <div className="grid grid-cols-6 gap-1.5 mt-1.5">
              {DIAS_ORDER.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDiaFilterList(d)}
                  className={cn(
                    'rounded-lg border py-2.5 text-sm font-medium transition-colors',
                    diaFilterList.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  {DIA_SEMANA_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
            <span className="text-sm text-gray-700">Mostrar inativos</span>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </label>
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPessoaFilter('')
                setDiaFilterList([])
                setLiderFilter('')
                setShowInactive(false)
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </Dialog>

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={createdCena ? 'Cena criada' : editingId ? 'Editar cena' : 'Nova cena'}
      >
        {createdCena ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </span>
            </div>
            <div>
              <p className="text-base font-semibold">{createdCena.nome}</p>
              <p className="text-sm text-emerald-600">Cena cadastrada com sucesso!</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {createdCena.participantes.map(uid => (
                <Avatar key={uid} photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-9 w-9 text-xs" />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleAddDetails}>
                Cadastrar mais detalhes da cena
              </Button>
              <Button variant="ghost" className="w-full text-gray-500" onClick={() => setModalOpen(false)}>
                Agora não
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="cena-nome">Nome</Label>
              <Input id="cena-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Cena 1 - Abertura" />
            </div>

            <div>
              <Label>Dia(s)</Label>
              <div className="grid grid-cols-6 gap-1.5 mt-1.5">
                {DIAS_ORDER.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDia(d)}
                    className={cn(
                      'rounded-lg border py-2.5 text-sm font-medium transition-colors',
                      dias.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                    )}
                  >
                    {DIA_SEMANA_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Participantes ({participantesUids.size})</Label>
              <Input placeholder="Buscar por nome" value={search} onChange={e => setSearch(e.target.value)} className="mt-1.5 mb-2" />
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-1.5">
                {!inscricoes && (
                  <div className="flex justify-center py-4">
                    <Spinner size="sm" />
                  </div>
                )}
                {inscricoes && filteredParticipantes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Ninguém encontrado.</p>
                )}
                {filteredParticipantes.map(i => (
                  <button
                    key={i.uid}
                    type="button"
                    onClick={() => toggleParticipante(i.uid)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      participantesUids.has(i.uid) ? 'bg-primary/10' : 'hover:bg-gray-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                        participantesUids.has(i.uid) ? 'border-primary bg-primary text-white' : 'border-gray-300',
                      )}
                    >
                      {participantesUids.has(i.uid) && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <Avatar photoURL={users[i.uid]?.photoURL} name={i.apelido || i.nomeCompleto} className="h-6 w-6 text-[10px]" />
                    <span className="truncate">{i.apelido || i.nomeCompleto}</span>
                  </button>
                ))}
              </div>
            </div>

            {personagensRecorrentes.length > 0 && (
              <div>
                <Label>Personagens recorrentes ({personagensRecorrentesSelecionados.size})</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                  Já cadastrados em outras cenas — selecione pra reaproveitar nessa.
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-1.5">
                  {personagensRecorrentes.map(o => {
                    const key = o.nome.trim().toLowerCase()
                    const selecionado = personagensRecorrentesSelecionados.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePersonagemRecorrente(key)}
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
              <Label>Horário</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => setHorarioMode('comum')}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-medium transition-colors',
                    horarioMode === 'comum' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  Horário comum
                </button>
                <button
                  type="button"
                  onClick={() => setHorarioMode('porDia')}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-medium transition-colors',
                    horarioMode === 'porDia' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  Horário por dia
                </button>
              </div>
              {horarioMode === 'comum' ? (
                <Input type="time" value={horarioDraft} onChange={e => setHorarioDraft(e.target.value)} />
              ) : dias.length === 0 ? (
                <p className="text-xs text-muted-foreground">Selecione ao menos um dia primeiro.</p>
              ) : (
                <div className="space-y-1.5">
                  {sortDias(dias).map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs font-medium text-gray-600">{DIA_SEMANA_LABELS[d]}</span>
                      <Input
                        type="time"
                        value={horariosPorDiaDraft[d] ?? ''}
                        onChange={e => setHorariosPorDiaDraft(prev => ({ ...prev, [d]: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar
            </Button>
          </div>
        )}
      </Dialog>

      <Dialog open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Desativar cena">
        {deactivateTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Desativar <span className="font-medium">{deactivateTarget.nome}</span>? Ela some da lista, mas fica guardada — só um
              admin pode reativar depois.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeactivateTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeactivate} disabled={deactivating}>
                {deactivating && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Desativar
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!hardDeleteTarget} onClose={() => setHardDeleteTarget(null)} title="Excluir definitivamente">
        {hardDeleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Excluir <span className="font-medium">{hardDeleteTarget.nome}</span> de vez? Essa ação apaga o registro pra sempre e não
              pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setHardDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleHardDelete} disabled={hardDeleting}>
                {hardDeleting && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Excluir de vez
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {liderModalCena?.liderUid && (
        <Dialog
          open={!!liderModalCena}
          onClose={() => setLiderModalCena(null)}
          title={
            <span className="flex items-center gap-2.5">
              <Avatar
                photoURL={users[liderModalCena.liderUid]?.photoURL}
                name={nameFor(liderModalCena.liderUid)}
                className="h-9 w-9 text-sm"
              />
              {nameFor(liderModalCena.liderUid)}
            </span>
          }
        >
          {(() => {
            const liderInscricao = inscricoesByUid[liderModalCena.liderUid]
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
                {!liderInscricao && <p className="py-3 text-sm text-muted-foreground">Sem dados de contato cadastrados.</p>}
              </div>
            )
          })()}
        </Dialog>
      )}
    </div>
  )
}
