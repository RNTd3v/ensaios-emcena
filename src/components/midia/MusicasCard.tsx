import { useEffect, useMemo, useRef, useState } from 'react'
import { Clapperboard, Music, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToCenas } from '@/services/firebase/cenas'
import {
  deleteMusica,
  juntarComLegado,
  subscribeToMusicas,
  trocarArquivoMusica,
  updateMusica,
  uploadMusica,
} from '@/services/firebase/midias'
import { useAuthStore } from '@/stores/authStore'
import { MUSICA_MAX_BYTES } from '@/lib/uploads'
import { cn } from '@/lib/utils'
import type { Cena, Musica } from '@/types'

type MusicaItem = Musica & { legado?: boolean }

const SEPARAR_POR_CENA_KEY = 'musicas.separarPorCena'

interface Props {
  /** Com cena: só as músicas dela. Sem cena: todas, agrupadas por cena. */
  cena?: Cena
  /**
   * Presente = modo gerenciar (só na página da equipe que cuida de músicas): cadastrar, editar,
   * trocar arquivo e excluir. `equipeId` vai no doc — é o que as firestore.rules conferem.
   * Ausente = só ouvir (cena, ensaio, página geral).
   */
  gerenciar?: { equipeId?: string }
  /** Sem o título (a página já tem) — no lugar, só a contagem. */
  semTitulo?: boolean
  /** Sem o Card por fora (quando a página já tem o próprio layout). */
  semCard?: boolean
}

/**
 * Músicas, com cena opcional. Só se gerencia na página da equipe responsável; no resto do app é só
 * pra ouvir. Itens ainda no formato antigo (array na cena, antes da migração) aparecem sem edição.
 */
export function MusicasCard({ cena, gerenciar, semTitulo, semCard }: Props) {
  const currentUser = useAuthStore(s => s.user)
  const pode = !!gerenciar
  const equipeId = gerenciar?.equipeId
  const [musicas, setMusicas] = useState<Musica[] | null>(null)
  const [cenas, setCenas] = useState<Cena[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<Musica | null>(null)
  const [excluindo, setExcluindo] = useState<Musica | null>(null)
  const [novaCenaId, setNovaCenaId] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const trocarRef = useRef<HTMLInputElement>(null)
  const [trocando, setTrocando] = useState<Musica | null>(null)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroCena, setFiltroCena] = useState<'todas' | 'sem' | string>('todas')
  // "Separar por cena" é preferência de visualização (ex.: desligar no ensaio geral) — fica salva
  // no aparelho; se o storage não estiver disponível, só vale enquanto a página está aberta.
  const [separarPorCena, setSepararPorCenaState] = useState(() => {
    try {
      return localStorage.getItem(SEPARAR_POR_CENA_KEY) !== 'nao'
    } catch {
      return true
    }
  })
  function setSepararPorCena(valor: boolean) {
    setSepararPorCenaState(valor)
    try {
      localStorage.setItem(SEPARAR_POR_CENA_KEY, valor ? 'sim' : 'nao')
    } catch {
      // storage indisponível (aba anônima etc.) — segue só em memória
    }
  }

  useEffect(() => subscribeToMusicas(cena?.id, setMusicas), [cena?.id])
  useEffect(() => {
    if (cena || !currentUser || !pode) return
    return subscribeToCenas(currentUser.role, currentUser.uid, lista => setCenas(lista.filter(c => c.ativo)))
  }, [cena, currentUser, pode])

  const itens: MusicaItem[] = useMemo(
    () => (cena ? juntarComLegado(musicas ?? [], cena.musicas, { cenaId: cena.id, cenaNome: cena.nome }) : (musicas ?? [])),
    [musicas, cena],
  )

  /** Cenas que aparecem nas músicas (pelo nome copiado), pro filtro. */
  const cenasDosItens = useMemo(() => {
    const m = new Map<string, string>()
    for (const mu of itens) if (mu.cenaId) m.set(mu.cenaId, mu.cenaNome ?? 'Cena')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter(m => {
      if (termo && !m.nome.toLowerCase().includes(termo)) return false
      if (filtroCena === 'sem' && m.cenaId) return false
      if (filtroCena !== 'todas' && filtroCena !== 'sem' && m.cenaId !== filtroCena) return false
      return true
    })
  }, [itens, busca, filtroCena])

  /** A busca por nome fica no próprio card; o modal de filtros só tem a cena. */
  const filtrosAtivos = !!busca.trim() || filtroCena !== 'todas'
  const filtroCenaAtivo = filtroCena !== 'todas'
  const mostrarBusca = !cena && itens.length > 0
  const mostrarFiltros = !cena && cenasDosItens.length > 0
  const indicadorFiltro = filtroCenaAtivo || !separarPorCena
  function limparFiltros() {
    setFiltroCena('todas')
    setSepararPorCena(true)
  }
  const resumoFiltros = [
    filtroCena === 'sem' ? 'Sem cena' : filtroCena !== 'todas' ? (cenasDosItens.find(([id]) => id === filtroCena)?.[1] ?? 'Cena') : null,
    !separarPorCena ? 'Sem separação por cena' : null,
  ].filter((x): x is string => !!x)

  const grupos = useMemo(() => {
    if (cena) return [{ chave: cena.id, titulo: '', itens: filtradas }]
    // Lista única, em ordem alfabética (a cena aparece embaixo do nome de cada música).
    if (!separarPorCena) return [{ chave: 'todas', titulo: '', itens: filtradas }]
    const porCena = new Map<string, { chave: string; titulo: string; itens: MusicaItem[] }>()
    for (const m of filtradas) {
      const chave = m.cenaId ?? ''
      if (!porCena.has(chave)) porCena.set(chave, { chave, titulo: m.cenaNome ?? (m.cenaId ? 'Cena' : 'Sem cena'), itens: [] })
      porCena.get(chave)!.itens.push(m)
    }
    return [...porCena.values()].sort((a, b) => (a.chave ? 0 : 1) - (b.chave ? 0 : 1) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
  }, [filtradas, cena, separarPorCena])

  function validar(file: File) {
    if (!file.type.startsWith('audio/')) return 'Só arquivos de áudio são aceitos.'
    if (file.size > MUSICA_MAX_BYTES) return 'Cada música precisa ter até 15MB.'
    return ''
  }

  async function handleUpload(files: FileList | null, cenaAlvo?: Cena) {
    if (!files || !currentUser) return
    setError('')
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const erro = validar(file)
        if (erro) {
          setError(erro)
          continue
        }
        await uploadMusica(file, { cenaId: cenaAlvo?.id, cenaNome: cenaAlvo?.nome, equipeId }, currentUser.uid)
      }
      setUploadOpen(false)
    } catch {
      setError('Não foi possível enviar. Tente de novo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleTrocar(file: File) {
    if (!trocando || !currentUser) return
    const erro = validar(file)
    if (erro) return setError(erro)
    setUploading(true)
    setError('')
    try {
      await trocarArquivoMusica(trocando, file, currentUser.uid, equipeId)
    } catch {
      setError('Não foi possível trocar. Tente de novo.')
    } finally {
      setUploading(false)
      setTrocando(null)
    }
  }

  function abrirUpload() {
    if (cena) inputRef.current?.click()
    else {
      setNovaCenaId('')
      setUploadOpen(true)
    }
  }

  const botaoFiltro = (
    <Button
      variant="outline"
      size="icon"
      className="relative h-11 w-11 shrink-0"
      onClick={() => setFiltrosOpen(true)}
      title="Filtros"
      aria-label="Filtros"
    >
      <SlidersHorizontal className="h-4 w-4" />
      {indicadorFiltro && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />}
    </Button>
  )
  const botaoAdicionar = (
    <Button variant="ghost" size="icon" className="shrink-0" onClick={abrirUpload} disabled={uploading} title="Adicionar música">
      {uploading ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
    </Button>
  )

  const conteudo = (
    <div className="space-y-2.5">
      {/* Título (quando a página não tem) + adicionar. Com busca, o filtro vai ao lado do campo. */}
      {(!semTitulo || (pode && !mostrarBusca) || (!mostrarBusca && mostrarFiltros)) && (
        <div className="flex items-center justify-between gap-2">
          {semTitulo ? (
            <span />
          ) : (
            <p className="flex items-center gap-1.5 text-base font-semibold">
              <Music className="h-4 w-4 text-primary" />
              Músicas
              {!!itens.length && !mostrarBusca && <span className="text-xs font-normal text-muted-foreground">({itens.length})</span>}
            </p>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
            {!mostrarBusca && mostrarFiltros && botaoFiltro}
            {pode && botaoAdicionar}
          </div>
        </div>
      )}
      {mostrarBusca && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar música pelo nome"
                className="pl-9 pr-9"
                aria-label="Buscar música"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-gray-100"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {mostrarFiltros && botaoFiltro}
            {semTitulo && pode && botaoAdicionar}
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            {filtrosAtivos ? `${filtradas.length} de ${itens.length}` : itens.length} {itens.length === 1 ? 'música' : 'músicas'}
          </p>
        </div>
      )}
      {semTitulo && !mostrarBusca && !!itens.length && (
        <p className="text-sm text-muted-foreground">
          {itens.length} {itens.length === 1 ? 'música' : 'músicas'}
        </p>
      )}
      {indicadorFiltro && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
          <span className="min-w-0 truncate">Filtrando: {resumoFiltros.join(' · ')}</span>
          <button type="button" onClick={limparFiltros} className="shrink-0 font-medium hover:underline">
            Limpar
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={e => {
          handleUpload(e.target.files, cena ?? cenas.find(c => c.id === novaCenaId))
          e.target.value = ''
        }}
      />
      <input
        ref={trocarRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleTrocar(file)
          e.target.value = ''
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {!musicas ? (
        <Spinner size="sm" />
      ) : !itens.length ? (
        <p className="py-1 text-xs text-muted-foreground">Nenhuma música ainda.</p>
      ) : !filtradas.length ? (
        <p className="py-1 text-xs text-muted-foreground">Nenhuma música com esses filtros.</p>
      ) : (
        <div className="space-y-3">
          {grupos.map(g => (
            // Cada cena num bloco próprio (com cabeçalho) e cada música separada por divisória.
            <div key={g.chave} className={cn(g.titulo && 'overflow-hidden rounded-xl border border-gray-200')}>
              {g.titulo && (
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {g.chave ? <Clapperboard className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Music className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <span className="truncate">{g.titulo}</span>
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{g.itens.length}</span>
                </div>
              )}
              <div className={cn('divide-y divide-gray-100', g.titulo && 'px-3')}>
                {g.itens.map(m => (
                  <div key={m.id} className="space-y-1 py-2.5 first:pt-2.5 last:pb-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.nome}</p>
                        {!cena && !separarPorCena && (
                          <p className="truncate text-xs text-muted-foreground">{m.cenaNome ?? 'Sem cena'}</p>
                        )}
                      </div>
                      {pode && !m.legado && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditando(m)} disabled={uploading} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setTrocando(m)
                              trocarRef.current?.click()
                            }}
                            disabled={uploading}
                            title="Trocar arquivo"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={() => setExcluindo(m)}
                            disabled={uploading}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <audio controls src={m.url} className="h-9 w-full" />
                  </div>
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

      <Dialog open={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtrar músicas">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
            <span>
              <span className="block text-sm text-gray-700">Separar por cena</span>
              <span className="block text-xs text-muted-foreground">Desligado: uma lista única, útil no ensaio geral.</span>
            </span>
            <input
              type="checkbox"
              checked={separarPorCena}
              onChange={e => setSepararPorCena(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </label>
          {cenasDosItens.length > 0 && (
            <div>
              <Label htmlFor="filtro-musica-cena">Cena</Label>
              <Select id="filtro-musica-cena" value={filtroCena} onChange={e => setFiltroCena(e.target.value)}>
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
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={limparFiltros} disabled={!indicadorFiltro}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setFiltrosOpen(false)}>
              Ver {filtradas.length} {filtradas.length === 1 ? 'música' : 'músicas'}
            </Button>
          </div>
        </div>
      </Dialog>

      {uploadOpen && (
        <Dialog open onClose={() => setUploadOpen(false)} title="Adicionar música">
          <div className="space-y-4">
            <div>
              <Label htmlFor="musica-cena">Cena (opcional)</Label>
              <Select id="musica-cena" value={novaCenaId} onChange={e => setNovaCenaId(e.target.value)}>
                <option value="">Nenhuma — vale pra peça toda</option>
                {cenas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full gap-1.5" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Music className="h-4 w-4" />}
              Escolher arquivos de áudio
            </Button>
          </div>
        </Dialog>
      )}

      {editando && (
        <EditarMusicaDialog musica={editando} cenas={cena ? undefined : cenas} equipeId={equipeId} onClose={() => setEditando(null)} />
      )}

      {excluindo && (
        <Dialog open onClose={() => setExcluindo(null)} title="Excluir música">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Excluir <span className="font-medium">{excluindo.nome}</span>? Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setExcluindo(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={uploading}
                onClick={async () => {
                  setUploading(true)
                  try {
                    await deleteMusica(excluindo, equipeId)
                    setExcluindo(null)
                  } catch {
                    setError('Não foi possível excluir. Tente de novo.')
                  } finally {
                    setUploading(false)
                  }
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}

function EditarMusicaDialog({
  musica,
  cenas,
  equipeId,
  onClose,
}: {
  musica: Musica
  /** Presente = dá pra trocar a cena (página geral). */
  cenas?: Cena[]
  equipeId?: string
  onClose: () => void
}) {
  const [nome, setNome] = useState(musica.nome)
  const [cenaId, setCenaId] = useState(musica.cenaId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const cenaForaDaLista = !!musica.cenaId && !!cenas && !cenas.some(c => c.id === musica.cenaId)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const cenaNome = cenas?.find(c => c.id === cenaId)?.nome ?? (cenaId === musica.cenaId ? musica.cenaNome : undefined)
      await updateMusica(
        musica.id,
        cenas ? { nome, cenaId: cenaId || undefined, cenaNome } : { nome, cenaId: musica.cenaId, cenaNome: musica.cenaNome },
        equipeId,
      )
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Editar música">
      <div className="space-y-4">
        <div>
          <Label htmlFor="musica-nome">Nome</Label>
          <Input id="musica-nome" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
        </div>
        {cenas && (
          <div>
            <Label htmlFor="musica-editar-cena">Cena (opcional)</Label>
            <Select id="musica-editar-cena" value={cenaId} onChange={e => setCenaId(e.target.value)}>
              <option value="">Nenhuma — vale pra peça toda</option>
              {cenaForaDaLista && <option value={musica.cenaId}>{musica.cenaNome ?? 'Cena'}</option>}
              {cenas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving || !nome.trim()}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>
      </div>
    </Dialog>
  )
}
