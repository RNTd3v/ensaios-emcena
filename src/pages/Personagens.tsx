import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronRight, Clapperboard, Plus, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToCenas } from '@/services/firebase/cenas'
import {
  addPersonagemNaCena,
  createPersonagem,
  deletePersonagem,
  removePersonagemDaCena,
  subscribeToCatalogoPersonagens,
  updatePersonagem,
} from '@/services/firebase/personagens'
import { useAuthStore } from '@/stores/authStore'
import { DIA_SEMANA_LABELS, type AppUser, type Cena, type DiaSemana, type Inscricao, type PersonagemCatalogo } from '@/types'
import { DIAS_ORDER, diasDisponiveis, sortDias } from '@/lib/dias'
import { agregarPersonagens, cenaCabeNaDisponibilidade, isCoro, personagemKey, type PersonagemAgregado } from '@/lib/personagens'
import { cn } from '@/lib/utils'

/**
 * Tela de personagens (só admin): junta os personagens de todas as cenas, sem duplicar por nome,
 * mais os criados aqui que ainda não estão em cena nenhuma. Daqui o admin vincula uma pessoa e
 * coloca o personagem em cenas — só as cenas cujos dias de ensaio cabem na disponibilidade da
 * pessoa vinculada.
 */
export function Personagens() {
  const currentUser = useAuthStore(s => s.user)
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [catalogo, setCatalogo] = useState<PersonagemCatalogo[] | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([])
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) return
    return subscribeToCenas(currentUser.role, currentUser.uid, setCenas)
  }, [currentUser])
  useEffect(() => subscribeToCatalogoPersonagens(setCatalogo), [])
  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])
  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const inscricoesByUid = useMemo(() => Object.fromEntries(inscricoes.map(i => [i.uid, i])), [inscricoes])

  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  function diasDe(uid: string | undefined): DiaSemana[] | undefined {
    return uid ? diasDisponiveis(inscricoesByUid[uid]?.disponibilidade.dias ?? []) : undefined
  }

  /** Papéis de coro repetem o nome — dentro do mesmo nome, ordena pela pessoa (sem pessoa por último). */
  const personagens = useMemo(
    () =>
      agregarPersonagens(cenas ?? [], catalogo ?? []).sort(
        (a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }) ||
          Number(!a.participanteUid) - Number(!b.participanteUid) ||
          (a.participanteUid && b.participanteUid ? nameFor(a.participanteUid).localeCompare(nameFor(b.participanteUid), 'pt-BR') : 0),
      ),
    [cenas, catalogo, inscricoesByUid, users],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return personagens
    return personagens.filter(
      p => p.nome.toLowerCase().includes(term) || (p.participanteUid && nameFor(p.participanteUid).toLowerCase().includes(term)),
    )
  }, [personagens, search, inscricoesByUid, users])

  /** Quem pode interpretar: mesmo critério da tela da cena (elenco ou técnica), só acessos ativos. */
  const pessoas = useMemo(
    () =>
      inscricoes
        .filter(i => users[i.uid]?.active !== false)
        .filter(i => i.areas.some(a => a === 'elenco' || a === 'tecnica'))
        .sort((a, b) => (a.apelido || a.nomeCompleto).localeCompare(b.apelido || b.nomeCompleto, 'pt-BR')),
    [inscricoes, users],
  )

  const selected = selectedKey ? personagens.find(p => p.key === selectedKey) : undefined
  const loading = !cenas || !catalogo

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Personagens</h1>
            {!loading && (
              <Badge variant="outline" className="mt-1 bg-white/10 text-white border-white/30 text-xs px-2 py-0.5">
                {search.trim() ? `Mostrando ${filtered.length} de ${personagens.length}` : `Total: ${personagens.length}`}
              </Badge>
            )}
          </div>
        </div>
        <Button size="icon" title="Novo personagem" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Input placeholder="Buscar por personagem ou pessoa" value={search} onChange={e => setSearch(e.target.value)} />

      {loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-sm text-white/80 py-6">
          {personagens.length === 0 ? 'Nenhum personagem cadastrado ainda.' : 'Nenhum personagem encontrado.'}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <Card className="p-2">
          {filtered.map(p => {
            const dias = diasDe(p.participanteUid)
            const cenasCount = new Set(p.ocorrencias.map(o => o.cena.id)).size
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedKey(p.key)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-gray-50"
              >
                <Avatar
                  photoURL={p.participanteUid ? users[p.participanteUid]?.photoURL : undefined}
                  name={p.nome}
                  className="h-10 w-10 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <p className="truncate text-xs text-gray-500">
                    {p.participanteUid ? nameFor(p.participanteUid) : 'Sem pessoa vinculada'}
                    {dias && dias.length > 0 && ` · ${sortDias(dias).map(d => DIA_SEMANA_LABELS[d]).join(', ')}`}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1 text-[11px] px-2 py-0.5">
                  <Clapperboard className="h-3 w-3" />
                  {cenasCount}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            )
          })}
        </Card>
      )}

      <CreatePersonagemDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        personagens={personagens}
        pessoas={pessoas}
        onCreated={key => {
          setCreateOpen(false)
          setSelectedKey(key)
        }}
      />

      {selected && currentUser && (
        <PersonagemDialog
          personagem={selected}
          onClose={() => setSelectedKey(null)}
          onRenamed={setSelectedKey}
          personagens={personagens}
          pessoas={pessoas}
          cenas={cenas ?? []}
          users={users}
          nameFor={nameFor}
          diasDe={diasDe}
          byUid={currentUser.uid}
        />
      )}
    </div>
  )
}

function PessoaOption({ i }: { i: Inscricao }) {
  const dias = diasDisponiveis(i.disponibilidade.dias).map(d => DIA_SEMANA_LABELS[d])
  return (
    <option value={i.uid}>
      {i.apelido || i.nomeCompleto}
      {dias.length ? ` (${dias.join(', ')})` : ' (sem disponibilidade)'}
    </option>
  )
}

interface CreatePersonagemDialogProps {
  open: boolean
  onClose: () => void
  personagens: PersonagemAgregado[]
  pessoas: Inscricao[]
  onCreated: (key: string) => void
}

function CreatePersonagemDialog({ open, onClose, personagens, pessoas, onCreated }: CreatePersonagemDialogProps) {
  const [nome, setNome] = useState('')
  const [participanteUid, setParticipanteUid] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setNome('')
    setParticipanteUid('')
    setError('')
  }, [open])

  async function handleSave() {
    const trimmed = nome.trim()
    if (!trimmed) {
      setError('Preencha o nome do personagem.')
      return
    }
    const key = personagemKey(trimmed, participanteUid || undefined)
    if (personagens.some(p => p.key === key)) {
      setError(isCoro(trimmed) ? 'Essa pessoa já tem esse papel.' : 'Já existe um personagem com esse nome.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createPersonagem(trimmed, participanteUid || undefined)
      onCreated(key)
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Novo personagem">
      <div className="space-y-4">
        <div>
          <Label htmlFor="novo-personagem-nome">Nome</Label>
          <Input id="novo-personagem-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do personagem" autoFocus />
        </div>
        <div>
          <Label htmlFor="novo-personagem-pessoa">Pessoa</Label>
          <Select id="novo-personagem-pessoa" value={participanteUid} onChange={e => setParticipanteUid(e.target.value)}>
            <option value="">Sem pessoa vinculada</option>
            {pessoas.map(i => (
              <PessoaOption key={i.uid} i={i} />
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving || !nome.trim()}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Criar personagem
        </Button>
      </div>
    </Dialog>
  )
}

interface PersonagemDialogProps {
  personagem: PersonagemAgregado
  onClose: () => void
  onRenamed: (key: string) => void
  personagens: PersonagemAgregado[]
  pessoas: Inscricao[]
  cenas: Cena[]
  users: Record<string, AppUser>
  nameFor: (uid: string) => string
  diasDe: (uid: string | undefined) => DiaSemana[] | undefined
  byUid: string
}

function PersonagemDialog({
  personagem,
  onClose,
  onRenamed,
  personagens,
  pessoas,
  cenas,
  users,
  nameFor,
  diasDe,
  byUid,
}: PersonagemDialogProps) {
  const [nome, setNome] = useState(personagem.nome)
  const [participanteUid, setParticipanteUid] = useState(personagem.participanteUid ?? '')
  const [saving, setSaving] = useState(false)
  const [busyCenaId, setBusyCenaId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  // Ressincroniza quando o personagem muda por fora (snapshot) ou é trocado.
  useEffect(() => {
    setNome(personagem.nome)
    setParticipanteUid(personagem.participanteUid ?? '')
  }, [personagem.nome, personagem.participanteUid])

  const dirty = nome.trim() !== personagem.nome || (participanteUid || undefined) !== personagem.participanteUid
  const dias = diasDe(personagem.participanteUid)
  const diasDraft = diasDe(participanteUid || undefined)

  const cenasAtuais = useMemo(() => {
    const porId = new Map(personagem.ocorrencias.map(o => [o.cena.id, o]))
    return [...porId.values()].sort((a, b) => a.cena.nome.localeCompare(b.cena.nome, 'pt-BR', { numeric: true }))
  }, [personagem.ocorrencias])

  /** Cenas atuais que a pessoa escolhida no seletor não consegue ensaiar — aviso antes de salvar. */
  const conflitosDraft = diasDraft ? cenasAtuais.filter(o => o.cena.ativo && !cenaCabeNaDisponibilidade(o.cena, diasDraft)) : []

  const cenasDisponiveis = useMemo(() => {
    const jaEsta = new Set(cenasAtuais.map(o => o.cena.id))
    return cenas
      .filter(c => c.ativo && !jaEsta.has(c.id))
      .filter(c => !dias || cenaCabeNaDisponibilidade(c, dias))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
  }, [cenas, cenasAtuais, dias])

  async function handleSave() {
    const trimmed = nome.trim()
    if (!trimmed) {
      setError('Preencha o nome do personagem.')
      return
    }
    const key = personagemKey(trimmed, participanteUid || undefined)
    if (key !== personagem.key && personagens.some(p => p.key === key)) {
      setError(isCoro(trimmed) ? 'Essa pessoa já tem esse papel.' : 'Já existe um personagem com esse nome.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updatePersonagem(personagem, { nome: trimmed, participanteUid: participanteUid || undefined }, byUid)
      onRenamed(key)
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCena(cena: Cena, action: 'add' | 'remove') {
    setBusyCenaId(cena.id)
    setError('')
    try {
      if (action === 'add') await addPersonagemNaCena(personagem, cena, byUid)
      else await removePersonagemDaCena(personagem, cena, byUid)
    } catch {
      setError('Não foi possível atualizar a cena. Tente de novo.')
    } finally {
      setBusyCenaId(null)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deletePersonagem(personagem, byUid)
      onClose()
    } catch {
      setError('Não foi possível excluir. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={personagem.nome}>
      <div className="space-y-5">
        <section className="space-y-3">
          <div>
            <Label htmlFor="personagem-nome">Nome</Label>
            <Input id="personagem-nome" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="personagem-pessoa">Pessoa</Label>
            <Select id="personagem-pessoa" value={participanteUid} onChange={e => setParticipanteUid(e.target.value)}>
              <option value="">Sem pessoa vinculada</option>
              {/* Mantém a pessoa atual na lista mesmo que ela não passe no filtro (ex.: acesso revogado). */}
              {personagem.participanteUid && !pessoas.some(i => i.uid === personagem.participanteUid) && (
                <option value={personagem.participanteUid}>{nameFor(personagem.participanteUid)}</option>
              )}
              {pessoas.map(i => (
                <PessoaOption key={i.uid} i={i} />
              ))}
            </Select>
          </div>
          {dirty && conflitosDraft.length > 0 && (
            <p className="flex gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {nameFor(participanteUid)} não tem disponibilidade para: {conflitosDraft.map(o => o.cena.nome).join(', ')}.
              </span>
            </p>
          )}
          {dirty && (
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar
            </Button>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold">Dias que pode ensaiar</p>
          {!dias ? (
            <p className="text-xs text-muted-foreground">Vincule uma pessoa para ver a disponibilidade.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {DIAS_ORDER.map(d => (
                <span
                  key={d}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    dias.includes(d) ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-gray-50 text-gray-400 line-through',
                  )}
                >
                  {DIA_SEMANA_LABELS[d]}
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold">Cenas ({cenasAtuais.length})</p>
          {cenasAtuais.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ainda não está em nenhuma cena.</p>
          ) : (
            <div className="space-y-1">
              {cenasAtuais.map(({ cena, personagem: p }) => {
                const conflito = dias && cena.ativo && !cenaCabeNaDisponibilidade(cena, dias)
                return (
                  <div key={cena.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
                    <Link to={`/cenas/${cena.id}/personagens/${p.id}`} className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{cena.nome}</span>
                        {!cena.ativo && <span className="shrink-0 text-[10px] font-normal text-gray-400">(inativa)</span>}
                      </p>
                      <p className={cn('flex items-center gap-1 text-xs', conflito ? 'text-amber-700' : 'text-gray-500')}>
                        {conflito && <AlertTriangle className="h-3 w-3 shrink-0" />}
                        {cena.dias.length ? sortDias(cena.dias).map(d => DIA_SEMANA_LABELS[d]).join(', ') : 'Sem dias definidos'}
                      </p>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Tirar da cena"
                      className="h-9 w-9 shrink-0 bg-red-50 text-red-600 hover:bg-red-100"
                      disabled={busyCenaId !== null}
                      onClick={() => handleCena(cena, 'remove')}
                    >
                      {busyCenaId === cena.id ? <Spinner size="sm" /> : <X className="h-4 w-4" />}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <p className="mb-1 text-sm font-semibold">Adicionar em cena</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {dias
              ? 'Só aparecem as cenas cujos dias de ensaio a pessoa tem disponíveis.'
              : 'Sem pessoa vinculada não há disponibilidade para filtrar — todas as cenas ativas aparecem.'}
          </p>
          {cenasDisponiveis.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma cena compatível.</p>
          ) : (
            <div className="space-y-1">
              {cenasDisponiveis.map(cena => (
                <div key={cena.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cena.nome}</p>
                    <p className="text-xs text-gray-500">
                      {cena.dias.length ? sortDias(cena.dias).map(d => DIA_SEMANA_LABELS[d]).join(', ') : 'Sem dias definidos'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Adicionar nessa cena"
                    className="h-9 w-9 shrink-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    disabled={busyCenaId !== null || dirty}
                    onClick={() => handleCena(cena, 'add')}
                  >
                    {busyCenaId === cena.id ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {dirty && cenasDisponiveis.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Salve as alterações acima antes de adicionar em cenas.</p>
          )}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" />
          Excluir personagem
        </Button>

        {personagem.participanteUid && users[personagem.participanteUid]?.active === false && (
          <p className="text-xs text-amber-700">A pessoa vinculada está com o acesso revogado.</p>
        )}
      </div>

      <Dialog open={confirmDelete} onClose={() => !saving && setConfirmDelete(false)} title="Excluir personagem?">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{personagem.nome}</span>
            {personagem.participanteUid && ` (${nameFor(personagem.participanteUid)})`} será excluído da base
            {cenasAtuais.length
              ? ` e removido de ${cenasAtuais.length} cena${cenasAtuais.length === 1 ? '' : 's'} (${cenasAtuais.map(o => o.cena.nome).join(', ')}), junto com a ficha.`
              : '.'}{' '}
            Não dá pra desfazer.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={saving}>
              {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Excluir
            </Button>
          </div>
        </div>
      </Dialog>
    </Dialog>
  )
}
