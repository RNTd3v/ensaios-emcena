import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import {
  createVersiculo,
  createVersiculos,
  deleteVersiculo,
  subscribeToVersiculos,
  updateVersiculo,
} from '@/services/firebase/versiculos'
import { VERSICULOS_SUGERIDOS } from '@/lib/versiculosSugeridos'
import type { Versiculo } from '@/types'

function normalizarReferencia(ref: string) {
  return ref.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Cadastro de versículos (só admin). A Home sorteia um deles a cada carregamento. */
export function AdminVersiculos() {
  const [versiculos, setVersiculos] = useState<Versiculo[] | null>(null)
  /** `null` = modal fechado; `'novo'` = criando; um versículo = editando. */
  const [editando, setEditando] = useState<Versiculo | 'novo' | null>(null)
  const [adicionandoSugeridos, setAdicionandoSugeridos] = useState(false)

  useEffect(() => subscribeToVersiculos(setVersiculos), [])

  const referenciasCadastradas = new Set((versiculos ?? []).map(v => normalizarReferencia(v.referencia)))
  const sugeridosFaltando = VERSICULOS_SUGERIDOS.filter(v => !referenciasCadastradas.has(normalizarReferencia(v.referencia)))

  async function handleAdicionarSugeridos() {
    setAdicionandoSugeridos(true)
    try {
      await createVersiculos(sugeridosFaltando)
    } finally {
      setAdicionandoSugeridos(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Versículos</h1>
            <p className="text-xs text-white/70">Um deles aparece na tela de início, sorteado a cada acesso.</p>
          </div>
        </div>
        <Button size="icon" title="Novo versículo" onClick={() => setEditando('novo')}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {versiculos && sugeridosFaltando.length > 0 && (
        <Button
          variant="outline"
          className="w-full gap-1.5 border-white/40 bg-white/10 text-white hover:bg-white/20"
          onClick={handleAdicionarSugeridos}
          disabled={adicionandoSugeridos}
        >
          {adicionandoSugeridos ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
          Adicionar {sugeridosFaltando.length} versículo{sugeridosFaltando.length === 1 ? '' : 's'} sugerido
          {sugeridosFaltando.length === 1 ? '' : 's'}
        </Button>
      )}

      {!versiculos ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : versiculos.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/80">Nenhum versículo cadastrado ainda.</p>
      ) : (
        <Card className="p-2">
          {versiculos.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => setEditando(v)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{v.referencia}</p>
                <p className="line-clamp-2 text-xs text-gray-500">{v.texto}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </button>
          ))}
        </Card>
      )}

      {editando && (
        <VersiculoDialog
          versiculo={editando === 'novo' ? undefined : editando}
          versiculos={versiculos ?? []}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

interface VersiculoDialogProps {
  versiculo?: Versiculo
  versiculos: Versiculo[]
  onClose: () => void
}

function VersiculoDialog({ versiculo, versiculos, onClose }: VersiculoDialogProps) {
  const [referencia, setReferencia] = useState(versiculo?.referencia ?? '')
  const [texto, setTexto] = useState(versiculo?.texto ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!referencia.trim() || !texto.trim()) {
      setError('Preencha a referência e o texto.')
      return
    }
    const ref = normalizarReferencia(referencia)
    if (versiculos.some(v => v.id !== versiculo?.id && normalizarReferencia(v.referencia) === ref)) {
      setError('Já existe um versículo com essa referência.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (versiculo) await updateVersiculo(versiculo.id, { referencia, texto })
      else await createVersiculo({ referencia, texto })
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!versiculo) return
    setSaving(true)
    try {
      await deleteVersiculo(versiculo.id)
      onClose()
    } catch {
      setError('Não foi possível excluir. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={versiculo ? 'Editar versículo' : 'Novo versículo'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="versiculo-referencia">Referência</Label>
          <Input
            id="versiculo-referencia"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder="Ex.: Colossenses 3:23"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="versiculo-texto">Texto</Label>
          <Textarea
            id="versiculo-texto"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="mt-1.5"
            placeholder="Tudo o que fizerem, façam de coração..."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full" onClick={handleSave} disabled={saving || !referencia.trim() || !texto.trim()}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>

        {versiculo &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir {versiculo.referencia}?</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={saving}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Excluir versículo
            </Button>
          ))}
      </div>
    </Dialog>
  )
}
