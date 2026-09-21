import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Clock, Pencil, Plus, SlidersHorizontal, Star, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
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
import { createElenco, deleteElenco, subscribeToElencos, updateElenco, type ElencoInput } from '@/services/firebase/elencos'
import { useAuthStore } from '@/stores/authStore'
import { DIA_SEMANA_LABELS, type AppUser, type DiaSemana, type Elenco, type Inscricao } from '@/types'
import { DIAS_ORDER, sortDias } from '@/lib/dias'
import { formatElencoHorario } from '@/lib/elencoHorario'
import { cn } from '@/lib/utils'

export function Elencos() {
  const currentUser = useAuthStore(s => s.user)
  const [elencos, setElencos] = useState<Elenco[] | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [search, setSearch] = useState('')

  const [nomeFilter, setNomeFilter] = useState('')
  const [pessoaFilter, setPessoaFilter] = useState('')
  const [diaFilterList, setDiaFilterList] = useState<DiaSemana[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const hasActiveFilters = pessoaFilter.trim() !== '' || diaFilterList.length > 0

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [participantesUids, setParticipantesUids] = useState<Set<string>>(new Set())
  const [liderUid, setLiderUid] = useState('')
  const [dias, setDias] = useState<DiaSemana[]>([])
  const [horarioMode, setHorarioMode] = useState<'comum' | 'porDia'>('comum')
  const [horario, setHorario] = useState('')
  const [horariosPorDia, setHorariosPorDia] = useState<Partial<Record<DiaSemana, string>>>({})
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Elenco | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    return subscribeToElencos(currentUser.role, currentUser.uid, setElencos)
  }, [currentUser])

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const inscricoesByUid = useMemo(() => Object.fromEntries((inscricoes ?? []).map(i => [i.uid, i])), [inscricoes])

  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  function toggleDiaFilterList(dia: DiaSemana) {
    setDiaFilterList(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  const filteredElencos = useMemo(() => {
    return (elencos ?? []).filter(elenco => {
      if (nomeFilter.trim() && !elenco.nome.toLowerCase().includes(nomeFilter.trim().toLowerCase())) return false
      if (diaFilterList.length > 0 && !elenco.dias.some(d => diaFilterList.includes(d))) return false
      if (pessoaFilter.trim()) {
        const term = pessoaFilter.trim().toLowerCase()
        if (!elenco.participantes.some(uid => nameFor(uid).toLowerCase().includes(term))) return false
      }
      return true
    })
  }, [elencos, nomeFilter, diaFilterList, pessoaFilter, inscricoesByUid, users])

  const filteredParticipantes = useMemo(() => {
    if (!inscricoes) return []
    if (!search.trim()) return inscricoes
    const term = search.toLowerCase()
    return inscricoes.filter(i => i.nomeCompleto.toLowerCase().includes(term) || i.apelido?.toLowerCase().includes(term))
  }, [inscricoes, search])

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

  function openCreateModal() {
    setEditingId(null)
    setNome('')
    setParticipantesUids(new Set())
    setLiderUid(currentUser?.role === 'lider' ? currentUser.uid : '')
    setDias([])
    setHorarioMode('comum')
    setHorario('')
    setHorariosPorDia({})
    setObservacao('')
    setSearch('')
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(elenco: Elenco) {
    setEditingId(elenco.id)
    setNome(elenco.nome)
    setParticipantesUids(new Set(elenco.participantes))
    setLiderUid(elenco.liderUid ?? '')
    setDias(elenco.dias)
    setHorarioMode(elenco.horarios ? 'porDia' : 'comum')
    setHorario(elenco.horario ?? '')
    setHorariosPorDia(elenco.horarios ?? {})
    setObservacao(elenco.observacao ?? '')
    setSearch('')
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!nome.trim() || dias.length === 0 || participantesUids.size === 0) {
      setFormError('Preencha nome, participantes e dia(s).')
      return
    }
    if (horarioMode === 'comum' && !horario) {
      setFormError('Preencha o horário.')
      return
    }
    if (horarioMode === 'porDia' && dias.some(d => !horariosPorDia[d])) {
      setFormError('Preencha o horário de todos os dias selecionados.')
      return
    }
    setSaving(true)
    setFormError('')
    const input: ElencoInput = {
      nome: nome.trim(),
      participantes: [...participantesUids],
      liderUid: liderUid || undefined,
      dias,
      horario: horarioMode === 'comum' ? horario : undefined,
      horarios: horarioMode === 'porDia' ? Object.fromEntries(dias.map(d => [d, horariosPorDia[d]])) : undefined,
      observacao: observacao.trim() || undefined,
    }
    try {
      if (editingId) await updateElenco(editingId, input)
      else await createElenco(input)
      if (liderUid && (users[liderUid]?.role ?? 'participante') === 'participante') {
        await updateUserRole(liderUid, 'lider')
        setUsers(prev => ({ ...prev, [liderUid]: { ...prev[liderUid], role: 'lider' } }))
      }
      setModalOpen(false)
    } catch {
      setFormError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteElenco(deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
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
        <h1 className="text-xl font-semibold text-white flex-1">Elencos</h1>
        <Button size="icon" onClick={openCreateModal} title="Novo elenco">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Buscar por nome do elenco" value={nomeFilter} onChange={e => setNomeFilter(e.target.value)} className="flex-1" />
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

      {!elencos && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {elencos && elencos.length === 0 && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">Nenhum elenco cadastrado ainda.</CardContent>
        </Card>
      )}

      {elencos && elencos.length > 0 && filteredElencos.length === 0 && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">Nenhum elenco encontrado com esse filtro.</CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filteredElencos.map(elenco => (
          <Card key={elenco.id} className="p-0">
            <CardContent className="px-4 py-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{elenco.nome}</p>
                  {elenco.liderUid && <p className="text-xs text-gray-500 truncate">Líder: {nameFor(elenco.liderUid)}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEditModal(elenco)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(elenco)} title="Excluir" className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex -space-x-2">
                {elenco.participantes.slice(0, 8).map(uid => {
                  const isLider = uid === elenco.liderUid
                  return (
                    <div key={uid} className={cn('relative', isLider && 'z-10')}>
                      <Avatar photoURL={users[uid]?.photoURL} name={nameFor(uid)} className="h-7 w-7 text-[10px] ring-2 ring-white" />
                      {isLider && (
                        <span
                          title="Líder"
                          className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-white"
                        >
                          <Star className="h-2 w-2 fill-current" />
                        </span>
                      )}
                    </div>
                  )
                })}
                {elenco.participantes.length > 8 && (
                  <div className="h-7 w-7 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-[10px] font-medium text-gray-600">
                    +{elenco.participantes.length - 8}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                {sortDias(elenco.dias).map(d => (
                  <Badge key={d} variant="outline" className="bg-sky-50 border-sky-200 text-sky-700 text-[10px]">
                    {DIA_SEMANA_LABELS[d]}
                  </Badge>
                ))}
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <Clock className="h-3 w-3" />
                  {formatElencoHorario(elenco)}
                </span>
              </div>

              {elenco.observacao && <p className="text-xs text-gray-500">{elenco.observacao}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="space-y-4">
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
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setPessoaFilter('')
                setDiaFilterList([])
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </Dialog>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar elenco' : 'Novo elenco'}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="elenco-nome">Nome</Label>
            <Input id="elenco-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Ensaio geral" />
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

          {participantesUids.size > 0 && (
            <div>
              <Label htmlFor="elenco-lider">Líder</Label>
              <Select id="elenco-lider" value={liderUid} onChange={e => setLiderUid(e.target.value)}>
                <option value="">Sem líder definido</option>
                {[...participantesUids].map(uid => (
                  <option key={uid} value={uid}>
                    {nameFor(uid)}
                  </option>
                ))}
              </Select>
              {liderUid && (users[liderUid]?.role ?? 'participante') === 'participante' && (
                <p className="text-xs text-muted-foreground mt-1">Essa pessoa vai virar Líder ao salvar.</p>
              )}
            </div>
          )}

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
              <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} />
            ) : dias.length === 0 ? (
              <p className="text-xs text-muted-foreground">Selecione ao menos um dia primeiro.</p>
            ) : (
              <div className="space-y-1.5">
                {sortDias(dias).map(d => (
                  <div key={d} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs font-medium text-gray-600">{DIA_SEMANA_LABELS[d]}</span>
                    <Input
                      type="time"
                      value={horariosPorDia[d] ?? ''}
                      onChange={e => setHorariosPorDia(prev => ({ ...prev, [d]: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="elenco-observacao">Observação (opcional)</Label>
            <Input id="elenco-observacao" value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
            Salvar
          </Button>
        </div>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir elenco">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Tem certeza que quer excluir <span className="font-medium">{deleteTarget.nome}</span>? Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Excluir
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
