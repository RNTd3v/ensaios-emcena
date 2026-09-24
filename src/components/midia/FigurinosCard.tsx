import { useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToCenas } from '@/services/firebase/cenas'
import { deleteFigurino, figurinoVisivel, juntarComLegado, subscribeToFigurinos, updateFigurino, uploadFigurino } from '@/services/firebase/midias'
import { useAuthStore } from '@/stores/authStore'
import { FIGURINO_MAX_BYTES } from '@/lib/uploads'
import type { Cena, FigurinoImagem } from '@/types'

type FigurinoItem = FigurinoImagem & { legado?: boolean }

interface Props {
  /** Com cena: só os figurinos dela. Sem cena: todos, agrupados por cena. */
  cena?: Cena
  /**
   * Presente = modo gerenciar (só na página da equipe que cuida de figurinos): cadastrar, editar e
   * excluir, vendo também as fotos do elenco ainda sem aprovação. Ausente = só ver (cena, página
   * geral) — e só o que já vale (cadastrado pela equipe ou aprovado pelo líder da cena).
   */
  gerenciar?: { equipeId?: string }
  titulo?: string
  /** Sem o título (a página já tem) — no lugar, só a contagem. */
  semTitulo?: boolean
  semCard?: boolean
}

/**
 * Figurinos (fotos). A equipe de figurino cadastra referências em qualquer cena (ou sem cena); o
 * elenco manda a foto do próprio figurino pela página do personagem, e o líder da cena aprova.
 */
export function FigurinosCard({ cena, gerenciar, titulo = 'Figurinos', semTitulo, semCard }: Props) {
  const currentUser = useAuthStore(s => s.user)
  const pode = !!gerenciar
  const equipeId = gerenciar?.equipeId
  const [figurinos, setFigurinos] = useState<FigurinoImagem[] | null>(null)
  const [cenas, setCenas] = useState<Cena[]>([])
  const [viewer, setViewer] = useState<FigurinoItem | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [filtroCena, setFiltroCena] = useState<'todas' | 'sem' | string>('todas')
  const [filtroPersonagem, setFiltroPersonagem] = useState<'todos' | 'geral' | string>('todos')
  const [filtroAprovacao, setFiltroAprovacao] = useState<'todas' | 'valendo' | 'pendente' | 'reprovado'>('todas')
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  useEffect(() => subscribeToFigurinos(cena?.id, setFigurinos), [cena?.id])
  useEffect(() => {
    if (cena || !currentUser || !pode) return
    return subscribeToCenas(currentUser.role, currentUser.uid, lista => setCenas(lista.filter(c => c.ativo)))
  }, [cena, currentUser, pode])

  const podeSubir = pode

  function podeEditar(f: FigurinoItem) {
    return pode && !f.legado
  }

  const itens: FigurinoItem[] = useMemo(() => {
    const base = cena
      ? juntarComLegado(figurinos ?? [], cena.figurinos, { cenaId: cena.id, cenaNome: cena.nome })
      : (figurinos ?? [])
    // Fora da página da equipe, só o que já vale (sem as fotos do elenco pendentes/reprovadas).
    return pode ? base : base.filter(figurinoVisivel)
  }, [figurinos, cena, pode])

  /** Opções dos filtros, a partir do que existe (cena/personagem pelo nome copiado no item). */
  const cenasDosItens = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of itens) if (f.cenaId) m.set(f.cenaId, f.cenaNome ?? 'Cena')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])

  const filtradosPorCena = useMemo(
    () =>
      itens.filter(f =>
        filtroCena === 'todas' ? true : filtroCena === 'sem' ? !f.cenaId : f.cenaId === filtroCena,
      ),
    [itens, filtroCena],
  )

  const personagensDosItens = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of filtradosPorCena) if (f.personagemId) m.set(f.personagemId, rotulo(f))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [filtradosPorCena])

  const filtrados = useMemo(
    () =>
      filtradosPorCena.filter(f => {
        if (filtroPersonagem === 'geral' && f.personagemId) return false
        if (filtroPersonagem !== 'todos' && filtroPersonagem !== 'geral' && f.personagemId !== filtroPersonagem) return false
        if (filtroAprovacao === 'valendo' && !figurinoVisivel(f)) return false
        if ((filtroAprovacao === 'pendente' || filtroAprovacao === 'reprovado') && f.aprovacao !== filtroAprovacao) return false
        return true
      }),
    [filtradosPorCena, filtroPersonagem, filtroAprovacao],
  )

  const filtrosAtivos = filtroCena !== 'todas' || filtroPersonagem !== 'todos' || filtroAprovacao !== 'todas'
  function limparFiltros() {
    setFiltroCena('todas')
    setFiltroPersonagem('todos')
    setFiltroAprovacao('todas')
  }
  const APROVACAO_LABEL = { valendo: 'Valendo', pendente: 'Aguardando', reprovado: 'Reprovadas' } as const
  const resumoFiltros = [
    filtroCena === 'sem' ? 'Sem cena' : filtroCena !== 'todas' ? (cenasDosItens.find(([id]) => id === filtroCena)?.[1] ?? 'Cena') : null,
    filtroPersonagem === 'geral'
      ? 'Geral'
      : filtroPersonagem !== 'todos'
        ? (personagensDosItens.find(([id]) => id === filtroPersonagem)?.[1] ?? 'Personagem')
        : null,
    filtroAprovacao !== 'todas' ? APROVACAO_LABEL[filtroAprovacao] : null,
  ].filter((x): x is string => !!x)
  const mostrarFiltros = (!cena && cenasDosItens.length > 0) || personagensDosItens.length > 0 || pode

  function rotulo(f: FigurinoItem) {
    if (!f.personagemId) return 'Geral'
    return (cena?.personagens.find(p => p.id === f.personagemId)?.nome ?? f.personagemNome) || 'Personagem'
  }

  const grupos = useMemo(() => {
    if (cena) {
      // Gerais primeiro, depois por personagem (na ordem da cena).
      const gerais = filtrados.filter(f => !f.personagemId)
      const ordem = new Map(cena.personagens.map((p, i) => [p.id, i]))
      const dePersonagem = filtrados
        .filter(f => f.personagemId)
        .sort((a, b) => (ordem.get(a.personagemId!) ?? 999) - (ordem.get(b.personagemId!) ?? 999))
      return [{ chave: cena.id, titulo: '', itens: [...gerais, ...dePersonagem] }]
    }
    const porCena = new Map<string, { chave: string; titulo: string; itens: FigurinoItem[] }>()
    for (const f of filtrados) {
      const chave = f.cenaId ?? ''
      if (!porCena.has(chave)) porCena.set(chave, { chave, titulo: f.cenaNome ?? (f.cenaId ? 'Cena' : 'Sem cena'), itens: [] })
      porCena.get(chave)!.itens.push(f)
    }
    return [...porCena.values()].sort((a, b) => (a.chave ? 0 : 1) - (b.chave ? 0 : 1) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
  }, [filtrados, cena])

  const conteudo = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        {semTitulo ? (
          <p className="text-sm text-muted-foreground">
            {filtrosAtivos ? `${filtrados.length} de ${itens.length}` : itens.length} {itens.length === 1 ? 'foto' : 'fotos'}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-base font-semibold">
            <ImageIcon className="h-4 w-4 text-primary" />
            {titulo}
            {!!itens.length && (
              <span className="text-xs font-normal text-muted-foreground">
                ({filtrosAtivos ? `${filtrados.length} de ${itens.length}` : itens.length})
              </span>
            )}
          </p>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {!!itens.length && mostrarFiltros && (
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setFiltrosOpen(true)}
              title="Filtros"
              aria-label="Filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {filtrosAtivos && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />}
            </Button>
          )}
          {podeSubir && (
            <Button variant="ghost" size="icon" onClick={() => setUploadOpen(true)} title="Adicionar foto">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {filtrosAtivos && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
          <span className="min-w-0 truncate">Filtrando: {resumoFiltros.join(' · ')}</span>
          <button type="button" onClick={limparFiltros} className="shrink-0 font-medium hover:underline">
            Limpar
          </button>
        </div>
      )}

      {!figurinos ? (
        <Spinner size="sm" />
      ) : !itens.length ? (
        <p className="py-1 text-xs text-muted-foreground">Sem fotos ainda.</p>
      ) : !filtrados.length ? (
        <p className="py-1 text-xs text-muted-foreground">Nenhuma foto com esses filtros.</p>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <div key={g.chave} className="space-y-1.5">
              {g.titulo && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>}
              <div className="grid grid-cols-3 gap-1.5">
                {g.itens.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setViewer(f)}
                    className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                  >
                    <img src={f.url} alt={f.legenda ?? ''} className="h-full w-full object-cover" loading="lazy" />
                    {f.aprovacao && f.aprovacao !== 'aprovado' && (
                      <span
                        className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white ${
                          f.aprovacao === 'pendente' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      >
                        {f.aprovacao === 'pendente' ? 'Aguardando' : 'Reprovada'}
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                      {rotulo(f)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      {semCard ? (
        conteudo
      ) : (
        <Card>
          <CardContent>{conteudo}</CardContent>
        </Card>
      )}

      <Dialog open={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtrar figurinos">
        <div className="space-y-4">
          {!cena && cenasDosItens.length > 0 && (
            <div>
              <Label htmlFor="filtro-figurino-cena">Cena</Label>
              <Select
                id="filtro-figurino-cena"
                value={filtroCena}
                onChange={e => {
                  setFiltroCena(e.target.value)
                  setFiltroPersonagem('todos')
                }}
              >
                <option value="todas">Todas as cenas</option>
                <option value="sem">Sem cena</option>
                {cenasDosItens.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {personagensDosItens.length > 0 && (
            <div>
              <Label htmlFor="filtro-figurino-personagem">Personagem</Label>
              <Select id="filtro-figurino-personagem" value={filtroPersonagem} onChange={e => setFiltroPersonagem(e.target.value)}>
                <option value="todos">Todos os personagens</option>
                <option value="geral">Geral (sem personagem)</option>
                {personagensDosItens.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {pode && (
            <div>
              <Label htmlFor="filtro-figurino-aprovacao">Aprovação</Label>
              <Select
                id="filtro-figurino-aprovacao"
                value={filtroAprovacao}
                onChange={e => setFiltroAprovacao(e.target.value as typeof filtroAprovacao)}
              >
                <option value="todas">Todas as fotos</option>
                <option value="valendo">Valendo (da equipe ou aprovadas)</option>
                <option value="pendente">Aguardando aprovação</option>
                <option value="reprovado">Reprovadas</option>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={limparFiltros} disabled={!filtrosAtivos}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setFiltrosOpen(false)}>
              Ver {filtrados.length} {filtrados.length === 1 ? 'foto' : 'fotos'}
            </Button>
          </div>
        </div>
      </Dialog>

      {uploadOpen && currentUser && (
        <FigurinoFormDialog
          cena={cena}
          cenas={cenas}
          equipeId={equipeId}
          podeSemCena={pode}
          byUid={currentUser.uid}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {viewer && (
        <FigurinoViewer
          figurino={viewer}
          rotulo={rotulo(viewer)}
          podeEditar={podeEditar(viewer)}
          cena={cena}
          cenas={cenas}
          equipeId={equipeId}
          podeSemCena={pode}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  )
}

interface FormProps {
  /** Editando uma foto já existente (sem novo upload). */
  figurino?: FigurinoImagem
  cena?: Cena
  cenas: Cena[]
  personagemFixo?: string
  equipeId?: string
  /** Só admin/equipe podem cadastrar sem cena (peça toda) ou em qualquer cena. */
  podeSemCena: boolean
  byUid?: string
  onClose: () => void
}

function FigurinoFormDialog({ figurino, cena, cenas, personagemFixo, equipeId, podeSemCena, byUid, onClose }: FormProps) {
  const [cenaId, setCenaId] = useState(cena?.id ?? figurino?.cenaId ?? '')
  const [personagemId, setPersonagemId] = useState(personagemFixo ?? figurino?.personagemId ?? '')
  const [legenda, setLegenda] = useState(figurino?.legenda ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cenaAlvo = cena ?? cenas.find(c => c.id === cenaId)
  const personagens = cenaAlvo?.personagens ?? []
  const cenaForaDaLista = !cena && !!figurino?.cenaId && !cenas.some(c => c.id === figurino.cenaId)

  function vinculo() {
    const personagem = personagens.find(p => p.id === personagemId)
    return {
      cenaId: cenaAlvo?.id ?? (cenaForaDaLista && cenaId === figurino?.cenaId ? figurino?.cenaId : undefined),
      cenaNome: cenaAlvo?.nome ?? (cenaForaDaLista && cenaId === figurino?.cenaId ? figurino?.cenaNome : undefined),
      personagemId: personagemId || undefined,
      personagemNome: personagem?.nome ?? (personagemId === figurino?.personagemId ? figurino?.personagemNome : undefined),
      legenda,
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !byUid) return
    setSaving(true)
    setError('')
    try {
      let enviou = false
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          setError('Só imagens são aceitas.')
          continue
        }
        if (file.size > FIGURINO_MAX_BYTES) {
          setError('Cada imagem precisa ter até 5MB.')
          continue
        }
        await uploadFigurino(file, { ...vinculo(), equipeId }, byUid)
        enviou = true
      }
      if (enviou) onClose()
    } catch {
      setError('Não foi possível enviar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdicao() {
    if (!figurino) return
    setSaving(true)
    setError('')
    try {
      await updateFigurino(figurino.id, vinculo(), equipeId)
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  const faltaCena = !podeSemCena && !cenaAlvo

  return (
    <Dialog open onClose={onClose} title={figurino ? 'Editar foto' : 'Adicionar figurino'}>
      <div className="space-y-4">
        {!cena && (
          <div>
            <Label htmlFor="figurino-cena">Cena {podeSemCena ? '(opcional)' : ''}</Label>
            <Select
              id="figurino-cena"
              value={cenaId}
              onChange={e => {
                setCenaId(e.target.value)
                setPersonagemId('')
              }}
            >
              <option value="">{podeSemCena ? 'Nenhuma — vale pra peça toda' : 'Escolha a cena'}</option>
              {cenaForaDaLista && <option value={figurino!.cenaId}>{figurino!.cenaNome ?? 'Cena'}</option>}
              {cenas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
        )}

        {!personagemFixo && personagens.length > 0 && (
          <div>
            <Label htmlFor="figurino-personagem">Personagem (opcional)</Label>
            <Select id="figurino-personagem" value={personagemId} onChange={e => setPersonagemId(e.target.value)}>
              <option value="">Geral da cena</option>
              {personagens.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="figurino-legenda">Legenda (opcional)</Label>
          <Input
            id="figurino-legenda"
            value={legenda}
            onChange={e => setLegenda(e.target.value)}
            placeholder="Ex.: capa vermelha com bordado dourado"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {figurino ? (
          <Button className="w-full" onClick={handleSaveEdicao} disabled={saving || faltaCena}>
            {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
            Salvar
          </Button>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Button className="w-full gap-1.5" onClick={() => inputRef.current?.click()} disabled={saving || faltaCena}>
              {saving ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <ImageIcon className="h-4 w-4" />}
              Escolher fotos
            </Button>
          </>
        )}
      </div>
    </Dialog>
  )
}

interface ViewerProps {
  figurino: FigurinoItem
  rotulo: string
  podeEditar: boolean
  cena?: Cena
  cenas: Cena[]
  equipeId?: string
  podeSemCena: boolean
  onClose: () => void
}

function FigurinoViewer({ figurino, rotulo, podeEditar, cena, cenas, equipeId, podeSemCena, onClose }: ViewerProps) {
  const [editando, setEditando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (editando) {
    return (
      <FigurinoFormDialog
        figurino={figurino}
        cena={cena}
        cenas={cenas}
        equipeId={equipeId}
        podeSemCena={podeSemCena}
        onClose={onClose}
      />
    )
  }

  return (
    <Dialog open onClose={onClose} title="Figurino">
      <div className="space-y-3">
        <img src={figurino.url} alt={figurino.legenda ?? ''} className="max-h-[55vh] w-full rounded-lg object-contain bg-gray-50" />
        <div className="text-xs text-muted-foreground">
          <p>
            {!cena && (figurino.cenaNome ? `${figurino.cenaNome} · ` : 'Sem cena · ')}
            {rotulo}
          </p>
          {figurino.legenda && <p className="mt-0.5 text-sm text-gray-700">{figurino.legenda}</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {podeEditar &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir essa foto? Essa ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await deleteFigurino(figurino, equipeId)
                      onClose()
                    } catch {
                      setError('Não foi possível excluir. Tente de novo.')
                      setSaving(false)
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setEditando(true)}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          ))}
      </div>
    </Dialog>
  )
}
