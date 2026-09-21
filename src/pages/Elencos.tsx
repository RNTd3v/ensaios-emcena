import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { getUsers } from '@/services/firebase/auth'
import { createElenco, deleteElenco, subscribeToElencos, updateElenco, type ElencoInput } from '@/services/firebase/elencos'
import { useAuthStore } from '@/stores/authStore'
import { DIA_SEMANA_LABELS, type AppUser, type DiaSemana, type Elenco, type Inscricao } from '@/types'
import { cn } from '@/lib/utils'

const DIAS_ORDER = Object.keys(DIA_SEMANA_LABELS) as DiaSemana[]

function sortDias(dias: DiaSemana[]): DiaSemana[] {
  return [...dias].sort((a, b) => DIAS_ORDER.indexOf(a) - DIAS_ORDER.indexOf(b))
}

export function Elencos() {
  const currentUser = useAuthStore(s => s.user)
  const [elencos, setElencos] = useState<Elenco[] | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [participantesUids, setParticipantesUids] = useState<Set<string>>(new Set())
  const [liderUid, setLiderUid] = useState('')
  const [dias, setDias] = useState<DiaSemana[]>([])
  const [horario, setHorario] = useState('')
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
    setHorario('')
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
    setHorario(elenco.horario)
    setObservacao(elenco.observacao ?? '')
    setSearch('')
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!nome.trim() || dias.length === 0 || !horario || participantesUids.size === 0) {
      setFormError('Preencha nome, participantes, dia(s) e horário.')
      return
    }
    setSaving(true)
    setFormError('')
    const input: ElencoInput = {
      nome: nome.trim(),
      participantes: [...participantesUids],
      liderUid: liderUid || undefined,
      dias,
      horario,
      observacao: observacao.trim() || undefined,
    }
    try {
      if (editingId) await updateElenco(editingId, input)
      else await createElenco(input)
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

      <div className="space-y-2">
        {(elencos ?? []).map(elenco => (
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
                {elenco.participantes.slice(0, 8).map(uid => (
                  <Avatar
                    key={uid}
                    photoURL={users[uid]?.photoURL}
                    name={nameFor(uid)}
                    className="h-7 w-7 text-[10px] ring-2 ring-white"
                  />
                ))}
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
                  {elenco.horario}
                </span>
              </div>

              {elenco.observacao && <p className="text-xs text-gray-500">{elenco.observacao}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

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
            <Label htmlFor="elenco-horario">Horário</Label>
            <Input id="elenco-horario" type="time" value={horario} onChange={e => setHorario(e.target.value)} />
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
