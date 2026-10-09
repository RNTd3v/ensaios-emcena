import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { CenaSelect } from '@/components/midia/CenaSelect'
import { subscribeToTodasCenas } from '@/services/firebase/cenas'
import {
  deleteImagemEquipe,
  subscribeToImagensDaCena,
  subscribeToImagensDaEquipe,
  updateImagemEquipe,
  uploadImagemEquipe,
} from '@/services/firebase/imagensEquipe'
import { useAuthStore } from '@/stores/authStore'
import { FIGURINO_MAX_BYTES } from '@/lib/uploads'
import { corsDoStorage } from '@/lib/imagem'
import { cn } from '@/lib/utils'
import type { Cena, Equipe, ImagemEquipe } from '@/types'

const ABERTO_KEY = 'referenciasEquipe.cardAberto'

type Props =
  | {
      /** Página da equipe: todas as imagens dela, agrupadas por cena ("Só da equipe" primeiro). */
      equipe: Equipe
      cena?: never
    }
  | {
      /** Página da cena: só ver as imagens marcadas pra ela, agrupadas por equipe (recolhível). */
      cena: Cena
      equipe?: never
    }

/**
 * Referências (imagens) que cada equipe sobe — igual aos figurinos, mas de qualquer equipe. Cada
 * imagem pode ser de uma cena (aparece também na página da cena) ou só da equipe.
 * Membros (e admin) sobem; líder, assistentes, admin e quem subiu editam e excluem.
 */
export function ReferenciasEquipeCard({ equipe, cena }: Props) {
  const currentUser = useAuthStore(s => s.user)
  const uid = currentUser?.uid
  const isAdmin = currentUser?.role === 'admin'
  const [imagens, setImagens] = useState<ImagemEquipe[] | null>(null)
  const [todasCenas, setTodasCenas] = useState<Cena[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewer, setViewer] = useState<ImagemEquipe | null>(null)

  const equipeId = equipe?.id
  const cenaId = cena?.id
  useEffect(() => {
    if (equipeId) return subscribeToImagensDaEquipe(equipeId, setImagens)
    if (cenaId) return subscribeToImagensDaCena(cenaId, setImagens)
  }, [equipeId, cenaId])

  const podeSubir = !!equipe && !!uid && (isAdmin || equipe.membros.includes(uid))
  const gerenciaEquipe = !!equipe && !!uid && (isAdmin || equipe.liderUid === uid || equipe.assistentes.includes(uid))
  function podeEditar(i: ImagemEquipe) {
    return !!equipe && (gerenciaEquipe || i.uploadedByUid === uid)
  }

  useEffect(() => {
    if (!podeSubir) return
    return subscribeToTodasCenas(setTodasCenas)
  }, [podeSubir])
  /** Admin também escolhe cenas inativas (escondidas até pedir, no CenaSelect). */
  const cenasEscolha = useMemo(() => (isAdmin ? todasCenas : todasCenas.filter(c => c.ativo)), [todasCenas, isAdmin])

  // Na cena o card é recolhível (como os figurinos); fica salvo no aparelho.
  const recolhivel = !!cena
  const [aberto, setAbertoState] = useState(() => {
    try {
      return localStorage.getItem(ABERTO_KEY) === 'sim'
    } catch {
      return false
    }
  })
  function alternarAberto() {
    setAbertoState(v => {
      try {
        localStorage.setItem(ABERTO_KEY, v ? 'nao' : 'sim')
      } catch {
        // storage indisponível — segue só em memória
      }
      return !v
    })
  }
  const fechado = recolhivel && !aberto

  const grupos = useMemo(() => {
    const m = new Map<string, { chave: string; titulo: string; itens: ImagemEquipe[] }>()
    for (const i of imagens ?? []) {
      const chave = equipe ? (i.cenaId ?? '') : i.equipeId
      const titulo = equipe ? (i.cenaId ? (i.cenaNome ?? 'Cena') : 'Só da equipe') : i.equipeNome
      if (!m.has(chave)) m.set(chave, { chave, titulo, itens: [] })
      m.get(chave)!.itens.push(i)
    }
    return [...m.values()].sort((a, b) => (a.chave ? 1 : 0) - (b.chave ? 1 : 0) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
  }, [imagens, equipe])

  // Na cena, sem imagem nenhuma não mostra o card.
  if (cena && !imagens?.length) return null

  const titulo = equipe ? 'Referências' : 'Referências das equipes'
  const contagem = imagens ? `${imagens.length} ${imagens.length === 1 ? 'imagem' : 'imagens'}` : ''

  return (
    <>
      <Card>
        <CardContent className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            {recolhivel ? (
              <button type="button" onClick={alternarAberto} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={aberto}>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', !aberto && '-rotate-90')} />
                <span className="text-base font-semibold">{titulo}</span>
                <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{contagem}</span>
              </button>
            ) : (
              <p className="flex items-center gap-1.5 text-base font-semibold">
                <ImageIcon className="h-4 w-4 text-primary" />
                {titulo}
                {!!imagens?.length && <span className="text-xs font-normal text-muted-foreground">({imagens.length})</span>}
              </p>
            )}
            {podeSubir && (
              <Button variant="ghost" size="icon" onClick={() => setUploadOpen(true)} title="Adicionar imagem">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!fechado &&
            (!imagens ? (
              <Spinner size="sm" />
            ) : !imagens.length ? (
              <p className="py-1 text-xs text-muted-foreground">Sem imagens ainda.</p>
            ) : (
              <div className="space-y-4">
                {grupos.map(g => (
                  <div key={g.chave} className="space-y-1.5">
                    {(grupos.length > 1 || !!cena || !!g.chave) && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
                    )}
                    <div className="grid grid-cols-3 gap-1.5">
                      {g.itens.map(i => (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => setViewer(i)}
                          className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                        >
                          <img src={i.url} crossOrigin={corsDoStorage(i.url)} alt={i.legenda ?? ''} className="h-full w-full object-cover" loading="lazy" />
                          {i.legenda && (
                            <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{i.legenda}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </CardContent>
      </Card>

      {uploadOpen && equipe && uid && (
        <ImagemFormDialog equipe={equipe} cenas={cenasEscolha} byUid={uid} onClose={() => setUploadOpen(false)} />
      )}

      {viewer && (
        <ImagemViewer
          imagem={viewer}
          equipe={equipe}
          cenas={cenasEscolha}
          mostrarEquipe={!!cena}
          podeEditar={podeEditar(viewer)}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  )
}

interface FormProps {
  equipe: Equipe
  cenas: Cena[]
  /** Editando uma imagem já existente (sem novo upload). */
  imagem?: ImagemEquipe
  byUid?: string
  onClose: () => void
}

function ImagemFormDialog({ equipe, cenas, imagem, byUid, onClose }: FormProps) {
  const [deCena, setDeCena] = useState(!!imagem?.cenaId)
  const [cenaId, setCenaId] = useState(imagem?.cenaId ?? '')
  const [legenda, setLegenda] = useState(imagem?.legenda ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cenaForaDaLista = !!imagem?.cenaId && !cenas.some(c => c.id === imagem.cenaId)
  const faltaCena = deCena && !cenaId

  function vinculo() {
    if (!deCena || !cenaId) return { legenda }
    const nome = cenas.find(c => c.id === cenaId)?.nome ?? (cenaId === imagem?.cenaId ? imagem?.cenaNome : undefined)
    return { cenaId, cenaNome: nome, legenda }
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
        await uploadImagemEquipe(file, equipe, vinculo(), byUid)
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
    if (!imagem) return
    setSaving(true)
    setError('')
    try {
      await updateImagemEquipe(imagem.id, vinculo())
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={imagem ? 'Editar imagem' : 'Adicionar referência'}>
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={deCena}
            onChange={e => setDeCena(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          É de uma cena
        </label>

        {deCena ? (
          <div>
            <Label htmlFor="referencia-cena">Cena</Label>
            <CenaSelect
              id="referencia-cena"
              value={cenaId}
              onChange={setCenaId}
              cenas={cenas}
              vazio="Escolha a cena"
              foraDaLista={cenaForaDaLista ? { value: imagem!.cenaId!, label: imagem!.cenaNome ?? 'Cena' } : undefined}
            />
            <p className="mt-1 text-xs text-muted-foreground">Aparece aqui e também na página da cena.</p>
          </div>
        ) : (
          <p className="-mt-2 text-xs text-muted-foreground">Fica só na página da equipe.</p>
        )}

        <div>
          <Label htmlFor="referencia-legenda">Legenda (opcional)</Label>
          <Input
            id="referencia-legenda"
            value={legenda}
            onChange={e => setLegenda(e.target.value)}
            placeholder="Ex.: modelo do cenário da vila"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {imagem ? (
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
              Escolher imagens
            </Button>
          </>
        )}
      </div>
    </Dialog>
  )
}

interface ViewerProps {
  imagem: ImagemEquipe
  /** Só na página da equipe dá pra editar/excluir. */
  equipe?: Equipe
  cenas: Cena[]
  mostrarEquipe: boolean
  podeEditar: boolean
  onClose: () => void
}

function ImagemViewer({ imagem, equipe, cenas, mostrarEquipe, podeEditar, onClose }: ViewerProps) {
  const [editando, setEditando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (editando && equipe) {
    return <ImagemFormDialog equipe={equipe} cenas={cenas} imagem={imagem} onClose={onClose} />
  }

  return (
    <Dialog open onClose={onClose} title="Referência">
      <div className="space-y-3">
        <img src={imagem.url} crossOrigin={corsDoStorage(imagem.url)} alt={imagem.legenda ?? ''} className="max-h-[55vh] w-full rounded-lg object-contain bg-gray-50" />
        <div className="text-xs text-muted-foreground">
          <p>{mostrarEquipe ? imagem.equipeNome : imagem.cenaId ? (imagem.cenaNome ?? 'Cena') : 'Só da equipe'}</p>
          {imagem.legenda && <p className="mt-0.5 text-sm text-gray-700">{imagem.legenda}</p>}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {podeEditar &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir essa imagem? Essa ação não pode ser desfeita.</p>
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
                      await deleteImagemEquipe(imagem)
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
