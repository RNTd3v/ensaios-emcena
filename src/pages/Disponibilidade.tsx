import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, CheckCircle2, Users, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { SelectAllRow } from '@/components/cena/SelectAllRow'
import { SelectionFloatingBar } from '@/components/cena/SelectionFloatingBar'
import { CreateCenaModal } from '@/components/cena/CreateCenaModal'
import { InscricaoInfo } from '@/components/inscricao/InscricaoInfo'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToCenas } from '@/services/firebase/cenas'
import { adicionarMembroEquipe, subscribeToEquipes } from '@/services/firebase/equipes'
import { useAuthStore } from '@/stores/authStore'
import { AREA_LABELS, DIA_SEMANA_LABELS, type Area, type AppUser, type Cena, type DiaSemana, type Equipe, type Inscricao } from '@/types'
import { AREA_ICONS } from '@/lib/areaIcons'
import { DIAS_ORDER, diasDisponiveis } from '@/lib/dias'
import { cn } from '@/lib/utils'
import { useSelectionVisibility } from '@/hooks/useSelectionVisibility'

const AREAS = Object.keys(AREA_LABELS) as Area[]

type AreaFilter = 'todas' | Area

export function Disponibilidade() {
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role === 'admin'
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('todas')
  const [openDay, setOpenDay] = useState<DiaSemana | null>(null)

  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
  const [cenaModalOpen, setCenaModalOpen] = useState(false)
  /** Pessoa cuja inscrição está aberta (toque na foto). */
  const [detalhe, setDetalhe] = useState<Inscricao | null>(null)
  const [equipes, setEquipes] = useState<Equipe[]>([])

  useSelectionVisibility(selectedUids.size > 0)

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, setCenas)
  }, [currentUser])

  useEffect(() => {
    if (!isAdmin) return
    return subscribeToEquipes(setEquipes)
  }, [isAdmin])

  const filtered = useMemo(() => {
    return (inscricoes ?? []).filter(i => {
      if (users[i.uid]?.active === false) return false
      if (areaFilter !== 'todas' && !i.areas.includes(areaFilter)) return false
      if (search) {
        const term = search.toLowerCase()
        if (!i.nomeCompleto.toLowerCase().includes(term) && !i.apelido?.toLowerCase().includes(term)) return false
      }
      return true
    })
  }, [inscricoes, areaFilter, search, users])

  const byDia = useMemo(() => {
    const map: Record<DiaSemana, Inscricao[]> = { seg: [], ter: [], qua: [], qui: [], sex: [], sab: [] }
    for (const i of filtered) {
      for (const d of diasDisponiveis(i.disponibilidade.dias)) {
        map[d].push(i)
      }
    }
    for (const d of DIAS_ORDER) {
      map[d].sort((a, b) => (a.apelido || a.nomeCompleto).localeCompare(b.apelido || b.nomeCompleto, 'pt-BR'))
    }
    return map
  }, [filtered])

  const selectedInscricoes = useMemo(
    () => (inscricoes ?? []).filter(i => selectedUids.has(i.uid)),
    [inscricoes, selectedUids],
  )

  const cenaCountByUid = useMemo(() => {
    const map: Record<string, number> = {}
    for (const cena of cenas ?? []) {
      if (!cena.ativo) continue
      for (const uid of cena.participantes) {
        map[uid] = (map[uid] ?? 0) + 1
      }
    }
    return map
  }, [cenas])

  const cenasByUid = useMemo(() => {
    const map: Record<string, Cena[]> = {}
    for (const cena of cenas ?? []) {
      if (!cena.ativo) continue
      for (const uid of cena.participantes) (map[uid] ??= []).push(cena)
    }
    return map
  }, [cenas])

  /** Com gente já selecionada, o toque continua selecionando; senão abre a inscrição. */
  function tocarPessoa(i: Inscricao) {
    if (isAdmin && selectedUids.size > 0) toggleSelectUid(i.uid)
    else setDetalhe(i)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Disponibilidade</h1>
      </div>

      <Input placeholder="Buscar por nome" value={search} onChange={e => setSearch(e.target.value)} />

      <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setAreaFilter('todas')}
          className={cn(
            'shrink-0 snap-start rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            areaFilter === 'todas' ? 'border-primary bg-primary text-white' : 'border-white/40 bg-white/10 text-white',
          )}
        >
          Todas as áreas
        </button>
        {AREAS.map(a => {
          const Icon = AREA_ICONS[a]
          return (
            <button
              key={a}
              type="button"
              onClick={() => setAreaFilter(a)}
              className={cn(
                'inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                areaFilter === a ? 'border-primary bg-primary text-white' : 'border-white/40 bg-white/10 text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {AREA_LABELS[a]}
            </button>
          )
        })}
      </div>

      {isAdmin && (
        <SelectAllRow
          totalCount={filtered.length}
          hasSelection={selectedUids.size > 0}
          onSelectAll={selectAllFiltered}
          onClear={() => setSelectedUids(new Set())}
        />
      )}

      {!inscricoes && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {inscricoes && (
        <div className="grid grid-cols-3 gap-2">
          {DIAS_ORDER.map(d => {
            const isOpen = openDay === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => setOpenDay(prev => (prev === d ? null : d))}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 shadow-sm transition-colors',
                  isOpen ? 'border-primary bg-primary text-white' : 'border-white/30 bg-white/10',
                )}
              >
                <span className="text-sm font-semibold text-white">{DIA_SEMANA_LABELS[d]}</span>
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', isOpen ? 'bg-white/15 text-white border-white/40' : 'bg-white/10 text-white border-white/30')}
                >
                  {byDia[d].length}
                </Badge>
                <ChevronDown className={cn('h-3.5 w-3.5', isOpen ? 'text-white rotate-180' : 'text-white/60')} />
              </button>
            )
          })}
        </div>
      )}

      {openDay && (
        <Card className={cn(selectedUids.size > 0 && 'mb-32')}>
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <p className="text-sm font-semibold">{DIA_SEMANA_LABELS[openDay]}</p>
              <Badge variant="outline" className="text-[10px]">
                {byDia[openDay].length}
              </Badge>
            </div>
            {byDia[openDay].length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">Ninguém disponível.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {byDia[openDay].map(i => {
                  const isSelected = selectedUids.has(i.uid)
                  const cenaCount = cenaCountByUid[i.uid] ?? 0
                  return (
                    <button
                      key={i.uid}
                      type="button"
                      onClick={() => tocarPessoa(i)}
                      className="flex flex-col items-center gap-1 text-center"
                    >
                      <div className="relative">
                        <Avatar
                          photoURL={users[i.uid]?.photoURL}
                          name={i.apelido || i.nomeCompleto}
                          className={cn('h-10 w-10 text-xs', isSelected && 'ring-2 ring-primary ring-offset-2')}
                        />
                        {cenaCount > 0 && (
                          <span
                            title={`${cenaCount} cena${cenaCount === 1 ? '' : 's'}`}
                            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-medium text-white ring-2 ring-white"
                          >
                            {cenaCount}
                          </span>
                        )}
                        {isSelected && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white ring-2 ring-white">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs leading-tight truncate w-full">{i.apelido || i.nomeCompleto}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        title={
          detalhe && (
            <span className="flex items-center gap-2.5">
              <Avatar photoURL={users[detalhe.uid]?.photoURL} name={detalhe.apelido || detalhe.nomeCompleto} className="h-9 w-9 text-sm" />
              {detalhe.apelido || detalhe.nomeCompleto}
            </span>
          )
        }
      >
        {detalhe && (
          <div className="space-y-4">
            <InscricaoInfo inscricao={detalhe} users={users} inscricoes={inscricoes ?? []} cenas={cenasByUid[detalhe.uid] ?? []} />
            {isAdmin && (
              <AcoesPessoa
                key={detalhe.uid}
                inscricao={detalhe}
                equipes={equipes}
                onAdicionarCena={() => {
                  setSelectedUids(prev => new Set(prev).add(detalhe.uid))
                  setDetalhe(null)
                  setCenaModalOpen(true)
                }}
                onSelecionar={() => {
                  setSelectedUids(prev => new Set(prev).add(detalhe.uid))
                  setDetalhe(null)
                }}
              />
            )}
          </div>
        )}
      </Dialog>

      {isAdmin && (
        <>
          <SelectionFloatingBar
            selectedInscricoes={selectedInscricoes}
            users={users}
            onCreateCena={() => setCenaModalOpen(true)}
            onClear={() => setSelectedUids(new Set())}
          />

          <CreateCenaModal
            open={cenaModalOpen}
            onOpenChange={setCenaModalOpen}
            selectedInscricoes={selectedInscricoes}
            users={users}
            onToggleParticipant={toggleSelectUid}
            defaultDias={openDay ? [openDay] : []}
            cenas={cenas ?? []}
            onCreated={() => setSelectedUids(new Set())}
          />
        </>
      )}
    </div>
  )
}

/**
 * Elenco vai pra cena (o mesmo fluxo da seleção); as outras áreas vão pra uma equipe.
 * Quem marcou elenco e outra área vê as duas opções.
 */
function AcoesPessoa({
  inscricao,
  equipes,
  onAdicionarCena,
  onSelecionar,
}: {
  inscricao: Inscricao
  equipes: Equipe[]
  onAdicionarCena: () => void
  onSelecionar: () => void
}) {
  const elenco = inscricao.areas.includes('elenco')
  const outraArea = inscricao.areas.some(a => a !== 'elenco')
  const disponiveis = equipes.filter(e => !e.membros.includes(inscricao.uid)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const jaEsta = equipes.filter(e => e.membros.includes(inscricao.uid))
  const [equipeId, setEquipeId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [adicionadaEm, setAdicionadaEm] = useState('')

  async function adicionarEquipe() {
    const equipe = equipes.find(e => e.id === equipeId)
    if (!equipe) return
    setSalvando(true)
    setErro('')
    try {
      await adicionarMembroEquipe(equipe.id, inscricao.uid)
      setAdicionadaEm(equipe.nome)
      setEquipeId('')
    } catch (err) {
      console.error('[disponibilidade] Falha ao adicionar na equipe:', err)
      setErro('Não foi possível adicionar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      {elenco && (
        <div className="flex flex-col gap-1">
          <Button className="w-full gap-1.5" onClick={onAdicionarCena}>
            <Users className="h-4 w-4" />
            Adicionar à cena
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-500" onClick={onSelecionar}>
            Selecionar e escolher mais pessoas
          </Button>
        </div>
      )}
      {outraArea && (
        <div className="space-y-2">
          {jaEsta.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Já está em: <span className="text-foreground">{jaEsta.map(e => e.nome).join(', ')}</span>
            </p>
          )}
          {disponiveis.length > 0 ? (
            <div className="flex gap-2">
              <Select value={equipeId} onChange={e => setEquipeId(e.target.value)} className="flex-1">
                <option value="">Escolha a equipe</option>
                {disponiveis.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </Select>
              <Button variant={elenco ? 'outline' : 'default'} className="shrink-0 gap-1.5" disabled={!equipeId || salvando} onClick={adicionarEquipe}>
                <UsersRound className="h-4 w-4" />
                {salvando ? 'Adicionando...' : 'Adicionar à equipe'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Já está em todas as equipes.</p>
          )}
          {adicionadaEm && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Agora faz parte da equipe {adicionadaEm}.
            </p>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
      )}
    </div>
  )
}
