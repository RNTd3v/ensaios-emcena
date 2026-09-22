import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { createCena } from '@/services/firebase/cenas'
import { useAuthStore } from '@/stores/authStore'
import { DIA_SEMANA_LABELS, type AppUser, type DiaSemana, type Inscricao } from '@/types'
import { DIAS_ORDER, sortDias } from '@/lib/dias'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedInscricoes: Inscricao[]
  users: Record<string, AppUser>
  onToggleParticipant: (uid: string) => void
  defaultDias?: DiaSemana[]
  /** Chamado assim que a cena é salva com sucesso (antes de mostrar a tela de sucesso) — usado pra limpar a seleção do host. */
  onCreated: () => void
}

/** Modal de "Cadastrar Cena": mesmo fluxo de seleção usado na tela Admin, reutilizável em qualquer página. */
export function CreateCenaModal({ open, onOpenChange, selectedInscricoes, users, onToggleParticipant, defaultDias, onCreated }: Props) {
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const [nome, setNome] = useState('')
  const [dias, setDias] = useState<DiaSemana[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedCena, setSavedCena] = useState<{ id: string; nome: string; pessoas: Inscricao[] } | null>(null)

  const defaultDiasRef = useRef(defaultDias)
  defaultDiasRef.current = defaultDias

  useEffect(() => {
    if (!open) return
    setNome('')
    const d = defaultDiasRef.current
    setDias(d && d.length > 0 ? sortDias(d) : [])
    setError('')
    setSavedCena(null)
  }, [open])

  function toggleDia(dia: DiaSemana) {
    setDias(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  function handleClose() {
    onOpenChange(false)
    setSavedCena(null)
  }

  async function handleSave() {
    if (!nome.trim() || dias.length === 0 || selectedInscricoes.length === 0) {
      setError('Preencha nome, pessoas e dia(s).')
      return
    }
    setSaving(true)
    setError('')
    if (!currentUser) return
    try {
      const finalNome = nome.trim()
      const id = await createCena(
        {
          nome: finalNome,
          participantes: selectedInscricoes.map(i => i.uid),
          personagens: [],
          dias,
        },
        currentUser.uid,
      )
      setSavedCena({ id, nome: finalNome, pessoas: selectedInscricoes })
      onCreated()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  function handleAddDetails() {
    if (!savedCena) return
    navigate(`/cenas/${savedCena.id}`)
  }

  return (
    <Dialog open={open} onClose={handleClose} title={savedCena ? 'Cena criada' : 'Cadastrar Cena'}>
      {savedCena ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
          </div>
          <div>
            <p className="text-base font-semibold">{savedCena.nome}</p>
            <p className="text-sm text-emerald-600">Cena cadastrada com sucesso!</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {savedCena.pessoas.map(p => (
              <Avatar key={p.uid} photoURL={users[p.uid]?.photoURL} name={p.apelido || p.nomeCompleto} className="h-9 w-9 text-xs" />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={handleAddDetails}>
              Cadastrar mais detalhes da cena
            </Button>
            <Button variant="ghost" className="w-full text-gray-500" onClick={handleClose}>
              Agora não
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="cena-nome">Nome</Label>
            <Input id="cena-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Cena 1 - Abertura" />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Pessoas selecionadas ({selectedInscricoes.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedInscricoes.map(i => (
                <Badge key={i.uid} variant="outline" className="gap-1.5 pl-1 pr-2 py-1">
                  <Avatar photoURL={users[i.uid]?.photoURL} name={i.apelido || i.nomeCompleto} className="h-5 w-5 text-[10px]" />
                  {i.apelido || i.nomeCompleto}
                  <button type="button" onClick={() => onToggleParticipant(i.uid)} className="text-gray-400 hover:text-gray-700">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Dia(s)</Label>
            <div className="grid grid-cols-6 gap-1.5 mt-1.5">
              {DIAS_ORDER.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDia(d)}
                  className={cn(
                    'rounded-lg border py-2.5 text-sm font-medium transition-colors',
                    dias.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  {DIA_SEMANA_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
            Salvar
          </Button>
        </div>
      )}
    </Dialog>
  )
}
