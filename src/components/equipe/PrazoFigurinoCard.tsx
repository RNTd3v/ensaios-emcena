import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { updateEquipePrazoFigurino } from '@/services/firebase/equipes'
import type { Equipe } from '@/types'

/**
 * Prazo pro elenco mandar a foto do figurino (aparece na página de cada personagem). Definido pela
 * equipe de figurino: admin, líder ou assistentes editam; os demais só veem.
 */
export function PrazoFigurinoCard({ equipe, podeEditar }: { equipe: Equipe; podeEditar: boolean }) {
  const [draft, setDraft] = useState(equipe.prazoFigurino ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateEquipePrazoFigurino(equipe.id, draft)
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          Prazo pra enviar a foto do figurino
        </p>
        {podeEditar ? (
          <>
            <div className="flex items-center gap-1.5">
              <Input type="date" value={draft} onChange={e => setDraft(e.target.value)} className="flex-1" />
              {draft !== (equipe.prazoFigurino ?? '') && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
                  Salvar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Aparece na página de cada personagem. Deixe vazio pra não ter prazo.</p>
          </>
        ) : (
          <p className="text-sm text-gray-700">
            {equipe.prazoFigurino
              ? new Date(`${equipe.prazoFigurino}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
              : 'Sem prazo definido.'}
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  )
}
