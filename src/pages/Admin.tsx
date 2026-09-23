import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { SelectAllRow } from '@/components/cena/SelectAllRow'
import { SelectionFloatingBar } from '@/components/cena/SelectionFloatingBar'
import { CreateCenaModal } from '@/components/cena/CreateCenaModal'
import { subscribeToAllInscricoes, updateInscricaoStatus } from '@/services/firebase/inscricoes'
import { getUsers, setUserActive, updateUserRole } from '@/services/firebase/auth'
import { subscribeToCenas } from '@/services/firebase/cenas'
import { useAuthStore } from '@/stores/authStore'
import {
  AREA_LABELS,
  DIA_SEMANA_LABELS,
  USER_ROLE_LABELS,
  type AppUser,
  type Area,
  type Cena,
  type DiaSemana,
  type Inscricao,
  type InscricaoStatus,
  type UserRole,
} from '@/types'
import { whatsappLink } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { AREA_ICONS } from '@/lib/areaIcons'
import { DIAS_ORDER, sortDias } from '@/lib/dias'
import { useSelectionVisibility } from '@/hooks/useSelectionVisibility'

type AreaFilter = 'todas' | Area
type RoleFilter = 'todos' | UserRole
type SortOption = 'recentes' | 'antigos' | 'nome'

const SORT_LABELS: Record<SortOption, string> = {
  recentes: 'Mais recentes',
  antigos: 'Mais antigos',
  nome: 'Nome (A-Z)',
}

export function Admin() {
  const currentUser = useAuthStore(s => s.user)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [cenas, setCenas] = useState<Cena[] | null>(null)
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
  const [cenaModalOpen, setCenaModalOpen] = useState(false)

  useSelectionVisibility(selectedUids.size > 0)

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

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, setCenas)
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

  const cenasByUid = useMemo(() => {
    const map: Record<string, Cena[]> = {}
    for (const cena of cenas ?? []) {
      if (!cena.ativo) continue
      for (const uid of cena.participantes) {
        ;(map[uid] ??= []).push(cena)
      }
    }
    return map
  }, [cenas])

  async function handleStatusChange(uid: string, status: InscricaoStatus) {
    await updateInscricaoStatus(uid, status)
    setSelected(sel => (sel && sel.uid === uid ? { ...sel, status } : sel))
  }

  async function handleToggleActive(uid: string, active: boolean) {
    if (!currentUser) return
    await setUserActive(uid, active, currentUser.uid)
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

      <SelectAllRow
        totalCount={filtered.length}
        hasSelection={selectedUids.size > 0}
        onSelectAll={selectAllFiltered}
        onClear={() => setSelectedUids(new Set())}
      />

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
                      const cenasCount = a === 'elenco' ? (cenasByUid[i.uid]?.length ?? 0) : 0
                      return (
                        <span key={a} className="inline-flex items-center gap-2.5">
                          {idx > 0 && <span className="text-gray-300">|</span>}
                          <span className="inline-flex items-center gap-1">
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            {AREA_LABELS[a]}
                            {cenasCount > 0 && (
                              <Badge variant="outline" className="ml-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
                                {cenasCount}
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

      <SelectionFloatingBar
        selectedInscricoes={selectedInscricoes}
        users={users}
        onCreateCena={() => setCenaModalOpen(true)}
        onClear={() => setSelectedUids(new Set())}
      />

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

      <CreateCenaModal
        open={cenaModalOpen}
        onOpenChange={setCenaModalOpen}
        selectedInscricoes={selectedInscricoes}
        users={users}
        onToggleParticipant={toggleSelectUid}
        defaultDias={diaFilter}
        cenas={cenas ?? []}
        onCreated={() => setSelectedUids(new Set())}
      />

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
              {!!cenasByUid[selected.uid]?.length && (
                <div className="py-3">
                  <p className="text-sm text-muted-foreground">Cenas</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {cenasByUid[selected.uid].map(cena => (
                      <Badge key={cena.id} variant="outline">
                        {cena.nome}
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
