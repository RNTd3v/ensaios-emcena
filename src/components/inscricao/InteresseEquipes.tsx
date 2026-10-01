import { useEffect, useState } from 'react'
import { ChevronRight, Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/Textarea'
import { equipeIcon } from '@/lib/equipeIcons'
import { cn } from '@/lib/utils'
import { getInscricao, salvarInteresseEquipes } from '@/services/firebase/inscricoes'
import type { Equipe, Inscricao } from '@/types'
import { interesseRespondido, precisaInformarInteresse } from '@/lib/interesse'
import { useEquipesOrdenadas } from '@/hooks/useEquipesOrdenadas'

interface CampoProps {
  equipes: Equipe[]
  value: string[]
  onChange: (ids: string[]) => void
  outro: string
  onOutroChange: (texto: string) => void
  erro?: string
}

/** "Em que você quer ajudar?": as equipes do app como chips + um campo livre. */
export function InteresseEquipesCampo({ equipes, value, onChange, outro, onOutroChange, erro }: CampoProps) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {equipes.map(e => {
          const Icon = equipeIcon(e.icone)
          const sel = value.includes(e.id)
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => toggle(e.id)}
              aria-pressed={sel}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors',
                sel ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-gray-300 bg-white text-gray-700',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {e.nome}
            </button>
          )
        })}
      </div>
      <Textarea
        value={outro}
        onChange={e => onOutroChange(e.target.value)}
        placeholder="Outra coisa? Conte aqui (opcional)"
        className="min-h-[60px]"
      />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  )
}

/**
 * Home: quem marcou staff/técnica e ainda não disse em que quer ajudar (inscrição de antes da
 * pergunta existir) responde por aqui, sem reabrir a inscrição. Some depois de respondido.
 */
export function InteresseEquipesCard({ uid }: { uid: string }) {
  const [inscricao, setInscricao] = useState<Inscricao | null>(null)
  const [aberto, setAberto] = useState(false)
  const equipes = useEquipesOrdenadas(aberto)
  const [ids, setIds] = useState<string[]>([])
  const [outro, setOutro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getInscricao(uid)
      .then(setInscricao)
      .catch(() => {})
  }, [uid])

  if (!inscricao || !precisaInformarInteresse(inscricao)) return null

  async function salvar() {
    if (!interesseRespondido(ids, outro)) return setErro('Escolha ao menos uma equipe ou conte no campo.')
    setSalvando(true)
    setErro('')
    try {
      await salvarInteresseEquipes(uid, ids, outro)
      setInscricao(i => (i ? { ...i, equipesInteresse: ids, ajudaOutro: outro.trim() } : i))
      setAberto(false)
    } catch {
      setErro('Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="block w-full text-left">
        <Card className="ring-2 ring-primary/60">
          <CardContent className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Hammer className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Conte em que você quer ajudar</p>
              <p className="text-xs text-muted-foreground">Cenário, som, iluminação... a gente te coloca na equipe certa.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          </CardContent>
        </Card>
      </button>

      <Dialog open={aberto} onClose={() => setAberto(false)} title="Em que você quer ajudar?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Pode escolher mais de uma.</p>
          <InteresseEquipesCampo equipes={equipes} value={ids} onChange={setIds} outro={outro} onOutroChange={setOutro} erro={erro} />
          <Button className="w-full" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
