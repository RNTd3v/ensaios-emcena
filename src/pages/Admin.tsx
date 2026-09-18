import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Settings, ShieldOff, ShieldCheck as ShieldCheckIcon, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { subscribeToAllInscricoes, updateInscricaoStatus } from '@/services/firebase/inscricoes'
import { getUsers, setUserActive } from '@/services/firebase/auth'
import { AREA_LABELS, DIA_SEMANA_LABELS, type AppUser, type Area, type Inscricao, type InscricaoStatus } from '@/types'
import { whatsappLink } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type AreaFilter = 'todas' | Area
type StatusFilter = 'todos' | InscricaoStatus

export function Admin() {
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('todas')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [selected, setSelected] = useState<Inscricao | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const hasActiveFilters = areaFilter !== 'todas' || statusFilter !== 'todos'

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const filtered = useMemo(() => {
    return (inscricoes ?? []).filter(i => {
      if (areaFilter !== 'todas' && !i.areas.includes(areaFilter)) return false
      if (statusFilter !== 'todos' && i.status !== statusFilter) return false
      if (search) {
        const term = search.toLowerCase()
        if (!i.nomeCompleto.toLowerCase().includes(term) && !i.apelido?.toLowerCase().includes(term)) return false
      }
      return true
    })
  }, [inscricoes, areaFilter, statusFilter, search])

  async function handleStatusChange(uid: string, status: InscricaoStatus) {
    await updateInscricaoStatus(uid, status)
    setSelected(sel => (sel && sel.uid === uid ? { ...sel, status } : sel))
  }

  async function handleToggleActive(uid: string, active: boolean) {
    await setUserActive(uid, active)
    setUsers(prev => ({ ...prev, [uid]: { ...prev[uid], active } }))
  }

  return (
    <div
      className="space-y-4"
    >
      <div className="flex items-start justify-between pb-4 border-b border-white/30">
        <div>
          <h1 className="text-xl font-semibold text-white">Inscritos</h1>
          <Badge variant="outline" className="bg-white/10 text-white border-white/30 text-xs px-2 py-0.5 mt-1.5">
            Total de inscritos: {inscricoes?.length ?? 0}
          </Badge>
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

      <div className="space-y-2">
        {filtered.map(i => {
          const active = users[i.uid]?.active !== false
          return (
            <div
              key={i.uid}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(i)}
              onKeyDown={e => e.key === 'Enter' && setSelected(i)}
              className="w-full text-left cursor-pointer"
            >
              <Card className={cn('p-0', !active && 'opacity-60')}>
                <CardContent className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar photoURL={users[i.uid]?.photoURL} name={i.apelido || i.nomeCompleto} className="h-8 w-8 text-xs" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{i.apelido || i.nomeCompleto}</p>
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
                        <StatusBadge status={i.status} />
                        {!active && (
                          <Badge variant="destructive" className="text-[10px]">
                            Revogado
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 w-full pt-3 border-t border-gray-100">
                    {i.areas.map(a => (
                      <Badge key={a} variant="outline" className="text-[10px]">
                        {AREA_LABELS[a]}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="space-y-4">
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
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Status</p>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="recusado">Recusado</option>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setAreaFilter('todas')
                setStatusFilter('todos')
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
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
              <div className="py-3">
                <p className="text-sm text-muted-foreground">Disponibilidade</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selected.disponibilidade.dias.map(d => (
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

function StatusBadge({ status }: { status: InscricaoStatus }) {
  const variant = status === 'confirmado' ? 'success' : status === 'recusado' ? 'destructive' : 'warning'
  const label = status === 'confirmado' ? 'Confirmado' : status === 'recusado' ? 'Recusado' : 'Pendente'
  return <Badge variant={variant}>{label}</Badge>
}
