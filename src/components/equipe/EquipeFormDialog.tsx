import { useMemo, useState } from 'react'
import { Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { createEquipe, updateEquipeDescricao, updateEquipeInfo } from '@/services/firebase/equipes'
import { DEFAULT_EQUIPE_ICON, EQUIPE_ICONS } from '@/lib/equipeIcons'
import { cn } from '@/lib/utils'
import type { AppUser, Equipe } from '@/types'

interface Props {
  /** Ausente = criando uma equipe nova (só admin). */
  equipe?: Equipe
  isAdmin: boolean
  users?: Record<string, AppUser>
  onClose: () => void
  onCreated?: (id: string) => void
}

/**
 * Criar/editar equipe. Admin mexe em tudo (nome, ícone, descrição, líder); o líder da equipe só na
 * descrição — os outros campos aparecem travados.
 */
export function EquipeFormDialog({ equipe, isAdmin, users = {}, onClose, onCreated }: Props) {
  const [nome, setNome] = useState(equipe?.nome ?? '')
  const [icone, setIcone] = useState(equipe?.icone ?? DEFAULT_EQUIPE_ICON)
  const [descricao, setDescricao] = useState(equipe?.descricao ?? '')
  const [liderUid, setLiderUid] = useState(equipe?.liderUid ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pessoas = useMemo(
    () =>
      Object.values(users)
        .filter(u => u.active !== false)
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')),
    [users],
  )

  async function handleSave() {
    if (!nome.trim()) {
      setError('Preencha o nome da equipe.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (!equipe) {
        const id = await createEquipe({ nome, icone, descricao })
        onCreated?.(id)
      } else if (isAdmin) {
        await updateEquipeInfo(equipe, { nome, icone, descricao, liderUid: liderUid || undefined })
      } else {
        await updateEquipeDescricao(equipe.id, descricao)
      }
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={equipe ? 'Editar equipe' : 'Nova equipe'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="equipe-nome">Nome</Label>
          <Input
            id="equipe-nome"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex.: Maquiagem"
            disabled={!isAdmin}
            autoFocus={isAdmin}
          />
        </div>

        {isAdmin && (
          <div>
            <Label>Ícone</Label>
            <div className="mt-1.5 grid grid-cols-6 gap-1.5">
              {Object.entries(EQUIPE_ICONS).map(([key, { icon: Icon, label }]) => (
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
        )}

        {isAdmin && equipe && (
          <div>
            <Label htmlFor="equipe-lider" className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              Líder
            </Label>
            <Select id="equipe-lider" value={liderUid} onChange={e => setLiderUid(e.target.value)}>
              <option value="">Sem líder</option>
              {pessoas.map(p => (
                <option key={p.uid} value={p.uid}>
                  {p.displayName}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Quem vira líder entra automaticamente na equipe.</p>
          </div>
        )}

        <div>
          <Label htmlFor="equipe-descricao">Descrição</Label>
          <Textarea
            id="equipe-descricao"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="mt-1.5"
            placeholder="O que essa equipe faz, como se organiza..."
            autoFocus={!isAdmin}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full" onClick={handleSave} disabled={saving || !nome.trim()}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          {equipe ? 'Salvar' : 'Criar equipe'}
        </Button>
      </div>
    </Dialog>
  )
}
