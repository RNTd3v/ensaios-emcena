import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  Clock,
  MessageCircle,
  Settings,
  ShieldOff,
  ShieldCheck as ShieldCheckIcon,
  SlidersHorizontal,
  Star,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { subscribeToAllInscricoes, updateInscricaoStatus } from '@/services/firebase/inscricoes'
import { getUsers, setUserActive, updateUserRole } from '@/services/firebase/auth'
import { createElenco, subscribeToElencos } from '@/services/firebase/elencos'
import { useAuthStore } from '@/stores/authStore'
import {
  AREA_LABELS,
  DIA_SEMANA_LABELS,
  USER_ROLE_LABELS,
  type AppUser,
  type Area,
  type DiaSemana,
  type Elenco,
  type Inscricao,
  type InscricaoStatus,
  type UserRole,
} from '@/types'
import { whatsappLink } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { AREA_ICONS } from '@/lib/areaIcons'
import { useSelectionStore } from '@/stores/selectionStore'

type AreaFilter = 'todas' | Area
type RoleFilter = 'todos' | UserRole
type SortOption = 'recentes' | 'antigos' | 'nome'

const SORT_LABELS: Record<SortOption, string> = {
  recentes: 'Mais recentes',
  antigos: 'Mais antigos',
  nome: 'Nome (A-Z)',
}

const DIAS_ORDER = Object.keys(DIA_SEMANA_LABELS) as DiaSemana[]

function sortDias(dias: DiaSemana[]): DiaSemana[] {
  return [...dias].sort((a, b) => DIAS_ORDER.indexOf(a) - DIAS_ORDER.indexOf(b))
}

export function Admin() {
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [elencos, setElencos] = useState<Elenco[] | null>(null)
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('todas')
  const [diaFilter, setDiaFilter] = useState<DiaSemana[]>([])
  const [diaMatchMode, setDiaMatchMode] = useState<'any' | 'all'>('any')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos')
  const [sortBy, setSortBy] = useState<SortOption>('recentes')
  const [selected, setSelected] = useState<Inscricao | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const hasActiveFilters = areaFilter !== 'todas' || diaFilter.length > 0 || roleFilter !== 'todos'

  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
  const [elencoModalOpen, setElencoModalOpen] = useState(false)
  const [elencoNome, setElencoNome] = useState('')
  const [elencoDias, setElencoDias] = useState<DiaSemana[]>([])
  const [elencoHorario, setElencoHorario] = useState('')
  const [elencoObservacao, setElencoObservacao] = useState('')
  const [elencoLiderUid, setElencoLiderUid] = useState('')
  const [savingElenco, setSavingElenco] = useState(false)
  const [elencoError, setElencoError] = useState('')
  const [savedElenco, setSavedElenco] = useState<{ nome: string; pessoas: Inscricao[] } | null>(null)

  function toggleDiaFilter(dia: DiaSemana) {
    setDiaFilter(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  function toggleSelectUid(uid: string) {
    setSelectedUids(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function selectAllFiltered() {
    setSelectedUids(new Set(filtered.map(i => i.uid)))
  }

  function toggleElencoDia(dia: DiaSemana) {
    setElencoDias(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  function openElencoModal() {
    setElencoNome('')
    setElencoDias(diaFilter.length > 0 ? sortDias(diaFilter) : [])
    setElencoHorario('')
    setElencoObservacao('')
    setElencoLiderUid('')
    setElencoError('')
    setSavedElenco(null)
    setElencoModalOpen(true)
  }

  function closeElencoModal() {
    setElencoModalOpen(false)
    setSavedElenco(null)
  }

  async function handleSaveElenco() {
    if (!elencoNome.trim() || elencoDias.length === 0 || !elencoHorario || selectedUids.size === 0) {
      setElencoError('Preencha nome, dia(s) e horário.')
      return
    }
    setSavingElenco(true)
    setElencoError('')
    try {
      const nome = elencoNome.trim()
      await createElenco({
        nome,
        participantes: [...selectedUids],
        liderUid: elencoLiderUid || undefined,
        dias: elencoDias,
        horario: elencoHorario,
        observacao: elencoObservacao.trim() || undefined,
      })
      if (elencoLiderUid && (users[elencoLiderUid]?.role ?? 'participante') === 'participante') {
        await handleRoleChange(elencoLiderUid, 'lider')
      }
      setSavedElenco({ nome, pessoas: selectedInscricoes })
      setSelectedUids(new Set())
    } catch {
      setElencoError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSavingElenco(false)
    }
  }

  useEffect(() => {
    useSelectionStore.setState({ hasSelection: selectedUids.size > 0 })
    setElencoLiderUid(prev => (prev && !selectedUids.has(prev) ? '' : prev))
  }, [selectedUids])

  useEffect(() => {
    return () => useSelectionStore.setState({ hasSelection: false })
  }, [])

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  useEffect(() => {
    if (!currentUser) return
    return subscribeToElencos(currentUser.role, currentUser.uid, setElencos)
  }, [currentUser])

  const filtered = useMemo(() => {
    const result = (inscricoes ?? []).filter(i => {
      if (areaFilter !== 'todas' && !i.areas.includes(areaFilter)) return false
      if (diaFilter.length > 0) {
        const disponivel =
          diaMatchMode === 'all'
            ? diaFilter.every(d => i.disponibilidade.dias.includes(d))
            : diaFilter.some(d => i.disponibilidade.dias.includes(d))
        if (!disponivel) return false
      }
      if (roleFilter !== 'todos' && (users[i.uid]?.role ?? 'participante') !== roleFilter) return false
      if (search) {
        const term = search.toLowerCase()
        if (!i.nomeCompleto.toLowerCase().includes(term) && !i.apelido?.toLowerCase().includes(term)) return false
      }
      return true
    })
    if (sortBy === 'nome') {
      result.sort((a, b) => (a.apelido || a.nomeCompleto).localeCompare(b.apelido || b.nomeCompleto, 'pt-BR'))
    } else if (sortBy === 'antigos') {
      result.reverse()
    }
    return result
  }, [inscricoes, areaFilter, diaFilter, diaMatchMode, roleFilter, users, search, sortBy])

  const pendentesCount = useMemo(() => (inscricoes ?? []).filter(i => i.status === 'pendente').length, [inscricoes])

  const selectedInscricoes = useMemo(
    () => (inscricoes ?? []).filter(i => selectedUids.has(i.uid)),
    [inscricoes, selectedUids],
  )

  const elencosByUid = useMemo(() => {
    const map: Record<string, Elenco[]> = {}
    for (const elenco of elencos ?? []) {
      for (const uid of elenco.participantes) {
        ;(map[uid] ??= []).push(elenco)
      }
    }
    return map
  }, [elencos])

  const [avatarRowWidth, setAvatarRowWidth] = useState(0)
  const avatarRowObserverRef = useRef<ResizeObserver | null>(null)

  // Ref-callback (em vez de useRef + useEffect com deps []): esse <div> só existe no DOM
  // quando há seleção, então precisamos (re)conectar o observer toda vez que ele monta/desmonta,
  // não só uma vez no mount do componente Admin.
  const avatarRowRef = useCallback((el: HTMLDivElement | null) => {
    avatarRowObserverRef.current?.disconnect()
    avatarRowObserverRef.current = null
    if (!el) return
    const observer = new ResizeObserver(entries => setAvatarRowWidth(entries[0].contentRect.width))
    observer.observe(el)
    avatarRowObserverRef.current = observer
  }, [])

  const AVATAR_SIZE = 28
  const AVATAR_STEP = 20 // 28px de avatar menos 8px de sobreposição (-space-x-2)
  const maxVisibleAvatars =
    avatarRowWidth > 0 ? Math.max(1, Math.floor((avatarRowWidth - AVATAR_SIZE) / AVATAR_STEP) + 1) : selectedInscricoes.length
  const visibleAvatarsCount =
    selectedInscricoes.length <= maxVisibleAvatars ? selectedInscricoes.length : maxVisibleAvatars - 1
  const hiddenAvatarsCount = selectedInscricoes.length - visibleAvatarsCount

  async function handleStatusChange(uid: string, status: InscricaoStatus) {
    await updateInscricaoStatus(uid, status)
    setSelected(sel => (sel && sel.uid === uid ? { ...sel, status } : sel))
  }

  async function handleToggleActive(uid: string, active: boolean) {
    await setUserActive(uid, active)
    setUsers(prev => ({ ...prev, [uid]: { ...prev[uid], active } }))
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    await updateUserRole(uid, role)
    setUsers(prev => ({ ...prev, [uid]: { ...prev[uid], role } }))
  }

  return (
    <div
      className="space-y-4"
    >
      <div className="flex items-start justify-between pb-4 border-b border-white/30">
        <div>
          <h1 className="text-xl font-semibold text-white">Participantes</h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge variant="outline" className="bg-white/10 text-white border-white/30 text-xs px-2 py-0.5">
              {hasActiveFilters || search.trim()
                ? `Mostrando ${filtered.length} de ${inscricoes?.length ?? 0}`
                : `Total de participantes: ${inscricoes?.length ?? 0}`}
            </Badge>
            {pendentesCount > 0 && (
              <Badge variant="warning" className="gap-1 text-xs px-2 py-0.5">
                <Clock className="h-3 w-3" />
                {pendentesCount} pendente{pendentesCount === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
        </div>
        <Link to="/admin/config">
          <Button variant="outline" size="icon" title="Configurações" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Buscar por nome" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
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

      <div className="flex items-center justify-between text-xs px-0.5">
        <button type="button" onClick={selectAllFiltered} className="font-medium text-white/90 hover:text-white">
          Selecionar todos{filtered.length > 0 ? ` (${filtered.length})` : ''}
        </button>
        {selectedUids.size > 0 && (
          <button type="button" onClick={() => setSelectedUids(new Set())} className="text-white/70 hover:text-white">
            Limpar
          </button>
        )}
      </div>

      {!inscricoes && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {inscricoes && filtered.length === 0 && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">
            Nenhuma inscrição encontrada com esse filtro.
          </CardContent>
        </Card>
      )}

      <div className={cn('space-y-2', selectedUids.size > 0 && 'pb-32')}>
        {filtered.map(i => {
          const active = users[i.uid]?.active !== false
          return (
            <div
              key={i.uid}
              role="button"
              tabIndex={0}
              onClick={() => toggleSelectUid(i.uid)}
              onKeyDown={e => e.key === 'Enter' && toggleSelectUid(i.uid)}
              className="w-full text-left cursor-pointer"
            >
              <Card className={cn('p-0', !active && 'opacity-60', selectedUids.has(i.uid) && 'ring-2 ring-primary')}>
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          selectedUids.has(i.uid) ? 'border-primary bg-primary text-white' : 'border-gray-300',
                        )}
                      >
                        {selectedUids.has(i.uid) && <Check className="h-3 w-3" />}
                      </span>
                      <Avatar photoURL={users[i.uid]?.photoURL} name={i.apelido || i.nomeCompleto} className="h-8 w-8 text-xs" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{i.apelido || i.nomeCompleto}</p>
                          <RoleChip role={users[i.uid]?.role} />
                        </div>
                        {i.apelido && <p className="text-xs text-gray-500 truncate">{i.nomeCompleto}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={whatsappLink(i.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        title="Abrir WhatsApp"
                        className="p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <div className="flex flex-col items-end gap-1">
                        <StatusIcon status={i.status} />
                        {!active && (
                          <Badge variant="destructive" className="text-[10px]">
                            Revogado
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 w-full pt-3 border-t border-gray-100 text-xs text-gray-600">
                    {i.areas.map((a, idx) => {
                      const Icon = AREA_ICONS[a]
                      const elencosCount = a === 'elenco' ? (elencosByUid[i.uid]?.length ?? 0) : 0
                      return (
                        <span key={a} className="inline-flex items-center gap-2.5">
                          {idx > 0 && <span className="text-gray-300">|</span>}
                          <span className="inline-flex items-center gap-1">
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            {AREA_LABELS[a]}
                            {elencosCount > 0 && (
                              <Badge variant="outline" className="ml-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
                                {elencosCount}
                              </Badge>
                            )}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                  <div className="flex items-end justify-between gap-2 pt-2">
                    <div className="flex flex-wrap gap-1">
                      {sortDias(i.disponibilidade.dias).map(d => (
                        <Badge
                          key={d}
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            diaFilter.includes(d)
                              ? 'bg-primary/15 border-primary text-primary font-semibold'
                              : 'bg-sky-50 border-sky-200 text-sky-700',
                          )}
                        >
                          {DIA_SEMANA_LABELS[d]}
                        </Badge>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setSelected(i)
                      }}
                      className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                    >
                      Detalhes
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      {selectedUids.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 left-0 z-30 px-4 pt-10 pb-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
          <div className="flex flex-col gap-2.5 rounded-2xl bg-white border border-gray-200 shadow-xl px-3 py-2.5">
            <div ref={avatarRowRef} className="flex -space-x-2 w-full">
              {selectedInscricoes.slice(0, visibleAvatarsCount).map(i => (
                <Avatar
                  key={i.uid}
                  photoURL={users[i.uid]?.photoURL}
                  name={i.apelido || i.nomeCompleto}
                  className="h-7 w-7 text-[10px] ring-2 ring-white shrink-0"
                />
              ))}
              {hiddenAvatarsCount > 0 && (
                <div className="h-7 w-7 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-[10px] font-medium text-gray-600 shrink-0">
                  +{hiddenAvatarsCount}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Button size="sm" className="w-full gap-1.5" onClick={openElencoModal}>
                <Users className="h-4 w-4" />
                Cadastrar Elenco
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => setSelectedUids(new Set())}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Ordenar por</p>
            <Select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map(s => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Perfil</p>
              <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)}>
                <option value="todos">Todos os perfis</option>
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map(r => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Área</p>
              <Select value={areaFilter} onChange={e => setAreaFilter(e.target.value as AreaFilter)}>
                <option value="todas">Todas as áreas</option>
                {(Object.keys(AREA_LABELS) as Area[]).map(a => (
                  <option key={a} value={a}>
                    {AREA_LABELS[a]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Disponibilidade</p>
            <div className="grid grid-cols-6 gap-1.5">
              {DIAS_ORDER.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDiaFilter(d)}
                  className={cn(
                    'rounded-lg border py-2.5 text-sm font-medium transition-colors',
                    diaFilter.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  {DIA_SEMANA_LABELS[d]}
                </button>
              ))}
            </div>
            {diaFilter.length > 1 && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setDiaMatchMode('any')}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-medium transition-colors',
                    diaMatchMode === 'any' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  Qualquer um desses dias
                </button>
                <button
                  type="button"
                  onClick={() => setDiaMatchMode('all')}
                  className={cn(
                    'rounded-lg border py-2 text-xs font-medium transition-colors',
                    diaMatchMode === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  Todos esses dias
                </button>
              </div>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setAreaFilter('todas')
                setDiaFilter([])
                setDiaMatchMode('any')
                setRoleFilter('todos')
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </Dialog>

      <Dialog open={elencoModalOpen} onClose={closeElencoModal} title={savedElenco ? 'Elenco criado' : 'Cadastrar Elenco'}>
        {savedElenco ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </span>
            </div>
            <div>
              <p className="text-base font-semibold">{savedElenco.nome}</p>
              <p className="text-sm text-emerald-600">Elenco cadastrado com sucesso!</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {savedElenco.pessoas.map(p => (
                <Avatar key={p.uid} photoURL={users[p.uid]?.photoURL} name={p.apelido || p.nomeCompleto} className="h-9 w-9 text-xs" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Deseja criar uma cena para esse elenco ou vincular a uma cena já criada?</p>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => navigate('/admin/em-construcao')}>
                Criar cena
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/em-construcao')}>
                Vincular a cena existente
              </Button>
              <Button variant="ghost" className="w-full text-gray-500" onClick={closeElencoModal}>
                Agora não
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="elenco-nome">Nome</Label>
              <Input id="elenco-nome" value={elencoNome} onChange={e => setElencoNome(e.target.value)} placeholder="Ex.: Ensaio geral" />
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1.5">
                Pessoas selecionadas ({selectedInscricoes.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedInscricoes.map(i => (
                  <Badge key={i.uid} variant="outline" className="gap-1.5 pl-1 pr-2 py-1">
                    <Avatar photoURL={users[i.uid]?.photoURL} name={i.apelido || i.nomeCompleto} className="h-5 w-5 text-[10px]" />
                    {i.apelido || i.nomeCompleto}
                    <button type="button" onClick={() => toggleSelectUid(i.uid)} className="text-gray-400 hover:text-gray-700">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="elenco-lider">Líder</Label>
              <Select id="elenco-lider" value={elencoLiderUid} onChange={e => setElencoLiderUid(e.target.value)}>
                <option value="">Sem líder definido</option>
                {selectedInscricoes.map(i => (
                  <option key={i.uid} value={i.uid}>
                    {i.apelido || i.nomeCompleto}
                  </option>
                ))}
              </Select>
              {elencoLiderUid && (users[elencoLiderUid]?.role ?? 'participante') === 'participante' && (
                <p className="text-xs text-muted-foreground mt-1">Essa pessoa vai virar Líder ao salvar.</p>
              )}
            </div>

            <div>
              <Label>Dia(s)</Label>
              <div className="grid grid-cols-6 gap-1.5 mt-1.5">
                {DIAS_ORDER.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleElencoDia(d)}
                    className={cn(
                      'rounded-lg border py-2.5 text-sm font-medium transition-colors',
                      elencoDias.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                    )}
                  >
                    {DIA_SEMANA_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="elenco-horario">Horário</Label>
              <Input id="elenco-horario" type="time" value={elencoHorario} onChange={e => setElencoHorario(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="elenco-observacao">Observação (opcional)</Label>
              <Input id="elenco-observacao" value={elencoObservacao} onChange={e => setElencoObservacao(e.target.value)} />
            </div>

            {elencoError && <p className="text-sm text-red-600">{elencoError}</p>}

            <Button className="w-full" onClick={handleSaveElenco} disabled={savingElenco}>
              {savingElenco && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar
            </Button>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected && (
            <span className="flex items-center gap-2.5">
              <Avatar
                photoURL={users[selected.uid]?.photoURL}
                name={selected.apelido || selected.nomeCompleto}
                className="h-9 w-9 text-sm"
              />
              {selected.apelido || selected.nomeCompleto}
            </span>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="divide-y divide-gray-100">
              <div className="pb-3">
                <p className="text-sm text-muted-foreground">Como quer ser chamado</p>
                <p className="text-base">{selected.apelido}</p>
              </div>
              <div className="py-3">
                <p className="text-sm text-muted-foreground">Telefone (WhatsApp)</p>
                <a
                  href={whatsappLink(selected.telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-base text-primary hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {selected.telefone}
                </a>
              </div>
              <div className="py-3">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-base">{selected.email}</p>
              </div>
              {selected.menorDeIdade && selected.responsavel && (
                <div className="py-3">
                  <p className="text-sm text-muted-foreground">Responsável (menor de idade)</p>
                  <p className="text-base">
                    {selected.responsavel.nome} ·{' '}
                    <a
                      href={whatsappLink(selected.responsavel.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {selected.responsavel.telefone}
                    </a>
                  </p>
                </div>
              )}
              <div className="py-3">
                <p className="text-sm text-muted-foreground">Áreas de interesse</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selected.areas.map(a => (
                    <Badge key={a} variant="outline">
                      {AREA_LABELS[a]}
                    </Badge>
                  ))}
                </div>
              </div>
              {!!elencosByUid[selected.uid]?.length && (
                <div className="py-3">
                  <p className="text-sm text-muted-foreground">Elencos</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {elencosByUid[selected.uid].map(elenco => (
                      <Badge key={elenco.id} variant="outline">
                        {elenco.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="py-3">
                <p className="text-sm text-muted-foreground">Disponibilidade</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sortDias(selected.disponibilidade.dias).map(d => (
                    <Badge key={d} variant="outline">
                      {DIA_SEMANA_LABELS[d]}
                    </Badge>
                  ))}
                </div>
                {selected.disponibilidade.observacao && (
                  <p className="text-sm text-muted-foreground mt-1.5">{selected.disponibilidade.observacao}</p>
                )}
              </div>
              {!!selected.indisponibilidade?.length && (
                <div className="py-3">
                  <p className="text-sm text-muted-foreground">Datas em que não pode</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selected.indisponibilidade.map(d => (
                      <Badge key={d} variant="outline">
                        {new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selected.observacoes && (
                <div className="py-3">
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-base">{selected.observacoes}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Status</p>
              <Select value={selected.status} onChange={e => handleStatusChange(selected.uid, e.target.value as InscricaoStatus)}>
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="recusado">Recusado</option>
              </Select>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1.5">Perfil</p>
              <Select
                value={users[selected.uid]?.role ?? 'participante'}
                onChange={e => handleRoleChange(selected.uid, e.target.value as UserRole)}
              >
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map(r => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>

            {users[selected.uid]?.active !== false ? (
              <Button variant="destructive" className="w-full" onClick={() => handleToggleActive(selected.uid, false)}>
                <ShieldOff className="h-4 w-4" />
                Revogar acesso
              </Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => handleToggleActive(selected.uid, true)}>
                <ShieldCheckIcon className="h-4 w-4" />
                Reativar acesso
              </Button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}

const STATUS_ICON: Record<InscricaoStatus, { icon: typeof CheckCircle2; label: string; className: string }> = {
  confirmado: { icon: CheckCircle2, label: 'Confirmado', className: 'bg-emerald-100 text-emerald-600' },
  pendente: { icon: Clock, label: 'Pendente', className: 'bg-amber-100 text-amber-600' },
  recusado: { icon: XCircle, label: 'Recusado', className: 'bg-red-100 text-red-600' },
}

function StatusIcon({ status }: { status: InscricaoStatus }) {
  const { icon: Icon, label, className } = STATUS_ICON[status]
  return (
    <span title={label} aria-label={label} className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full', className)}>
      <Icon className="h-4 w-4" />
    </span>
  )
}

function RoleChip({ role }: { role?: UserRole }) {
  if (role === 'admin') {
    return (
      <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 px-1.5 py-0 text-[10px] text-violet-700 shrink-0">
        <ShieldCheckIcon className="h-3 w-3" />
        Admin
      </Badge>
    )
  }
  if (role === 'lider') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700 shrink-0">
        <Star className="h-3 w-3" />
        Líder
      </Badge>
    )
  }
  return null
}
