import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { createLocal, deleteLocal, mapsLink, subscribeToLocais, updateLocal } from '@/services/firebase/locais'
import type { LocalEnsaio } from '@/types'
import { DEFAULT_LOCAL_ICON, LOCAL_ICONS, localIcon } from '@/lib/localIcons'
import { cn } from '@/lib/utils'

/** Cadastro de locais de ensaio (só admin). Os locais aparecem como opção ao editar um ensaio. */
export function AdminLocais() {
  const [locais, setLocais] = useState<LocalEnsaio[] | null>(null)
  /** `null` = modal fechado; `'novo'` = criando; um local = editando. */
  const [editando, setEditando] = useState<LocalEnsaio | 'novo' | null>(null)

  useEffect(() => subscribeToLocais(setLocais), [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-white">Locais de ensaio</h1>
        </div>
        <Button size="icon" title="Novo local" onClick={() => setEditando('novo')}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {!locais ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : locais.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/80">Nenhum local cadastrado ainda.</p>
      ) : (
        <Card className="p-2">
          {locais.map(l => {
            const Icon = localIcon(l.icone)
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setEditando(l)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.nome}</p>
                  {l.endereco && <p className="truncate text-xs text-gray-500">{l.endereco}</p>}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            )
          })}
        </Card>
      )}

      {editando && (
        <LocalDialog
          local={editando === 'novo' ? undefined : editando}
          locais={locais ?? []}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}

interface LocalDialogProps {
  local?: LocalEnsaio
  locais: LocalEnsaio[]
  onClose: () => void
}

function LocalDialog({ local, locais, onClose }: LocalDialogProps) {
  const [nome, setNome] = useState(local?.nome ?? '')
  const [endereco, setEndereco] = useState(local?.endereco ?? '')
  const [observacao, setObservacao] = useState(local?.observacao ?? '')
  const [icone, setIcone] = useState(local?.icone ?? DEFAULT_LOCAL_ICON)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const trimmed = nome.trim()
    if (!trimmed) {
      setError('Preencha o nome do local.')
      return
    }
    if (locais.some(l => l.id !== local?.id && l.nome.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError('Já existe um local com esse nome.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (local) await updateLocal(local.id, { nome: trimmed, endereco, observacao, icone })
      else await createLocal({ nome: trimmed, endereco, observacao, icone })
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!local) return
    setSaving(true)
    try {
      await deleteLocal(local.id)
      onClose()
    } catch {
      setError('Não foi possível excluir. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={local ? 'Editar local' : 'Novo local'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="local-nome">Nome</Label>
          <Input id="local-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Salão da igreja" autoFocus />
        </div>
        <div>
          <Label>Ícone</Label>
          <div className="mt-1.5 grid grid-cols-6 gap-1.5">
            {Object.entries(LOCAL_ICONS).map(([key, { icon: Icon, label }]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={icone === key}
                onClick={() => setIcone(key)}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-xl border transition-colors',
                  icone === key ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="local-endereco">Endereço</Label>
          <Input
            id="local-endereco"
            value={endereco}
            onChange={e => setEndereco(e.target.value)}
            placeholder="Ex.: Rua das Flores, 123 - Centro"
          />
          {endereco.trim() && (
            <a
              href={mapsLink({ nome, endereco })}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Ver no mapa
            </a>
          )}
        </div>
        <div>
          <Label htmlFor="local-observacao">Observação</Label>
          <Textarea
            id="local-observacao"
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            className="mt-1.5"
            placeholder="Ex.: entrada pelo portão lateral, sala 2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full" onClick={handleSave} disabled={saving || !nome.trim()}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>

        {local &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">
                Excluir "{local.nome}"? Ensaios já marcados com esse local continuam mostrando o nome.
              </p>
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
              Excluir local
            </Button>
          ))}
      </div>
    </Dialog>
  )
}
