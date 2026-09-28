import { useMemo, useState } from 'react'
import { Crown, HandHelping, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import type { AppUser } from '@/types'
import { PessoaSelect, inscritosConfirmados, pessoaOpcao } from '@/components/ui/PessoaSelect'

interface Props {
  titulo: string
  liderUid?: string
  assistentes?: string[]
  users: Record<string, AppUser>
  onSave: (liderUid: string | undefined, assistentes: string[]) => Promise<void>
  onClose: () => void
}

/** Escolher o líder (um) e os assistentes (vários) de uma área — ex.: metas e gastos. */
export function LiderAssistentesDialog({ titulo, liderUid, assistentes: iniciais = [], users, onSave, onClose }: Props) {
  const [lider, setLider] = useState(liderUid ?? '')
  const [assistentes, setAssistentes] = useState<string[]>(iniciais)
  const [novo, setNovo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pessoas = useMemo(
    () =>
      inscritosConfirmados(users, [liderUid, ...iniciais])
        .map(u => pessoaOpcao(u.uid, u))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [users, liderUid, iniciais],
  )

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await onSave(lider || undefined, assistentes.filter(a => a !== lider))
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={titulo}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="funcao-lider" className="flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Líder
          </Label>
          <PessoaSelect
            id="funcao-lider"
            value={lider}
            onChange={setLider}
            pessoas={pessoas}
            extras={[{ value: '', label: 'Sem líder' }]}
            titulo="Escolher líder"
          />
        </div>

        <div>
          <Label className="flex items-center gap-1.5">
            <HandHelping className="h-3.5 w-3.5 text-primary" />
            Assistentes
          </Label>
          {assistentes.length > 0 && (
            <div className="mb-2 mt-1.5 space-y-1">
              {assistentes.map(a => (
                <div key={a} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{users[a]?.displayName ?? 'Sem nome'}</span>
                  <button
                    type="button"
                    onClick={() => setAssistentes(prev => prev.filter(x => x !== a))}
                    title="Remover"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <PessoaSelect
                value={novo}
                onChange={setNovo}
                pessoas={pessoas.filter(p => p.uid !== lider && !assistentes.includes(p.uid))}
                placeholder="Adicionar assistente..."
                titulo="Adicionar assistente"
                aria-label="Adicionar assistente"
              />
            </div>
            <Button
              size="icon"
              disabled={!novo}
              onClick={() => {
                setAssistentes(prev => [...prev, novo])
                setNovo('')
              }}
              className="shrink-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              title="Adicionar"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>
      </div>
    </Dialog>
  )
}
