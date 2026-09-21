import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { createElenco } from '@/services/firebase/elencos'
import { updateUserRole } from '@/services/firebase/auth'
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
  /** Chamado assim que o elenco é salvo com sucesso (antes de mostrar a tela de sucesso) — usado pra limpar a seleção do host. */
  onCreated: () => void
  onLiderPromoted?: (uid: string) => void
}

/** Modal de "Cadastrar Elenco": mesmo fluxo de seleção usado na tela Admin, reutilizável em qualquer página. */
export function CreateElencoModal({
  open,
  onOpenChange,
  selectedInscricoes,
  users,
  onToggleParticipant,
  defaultDias,
  onCreated,
  onLiderPromoted,
}: Props) {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [dias, setDias] = useState<DiaSemana[]>([])
  const [horarioMode, setHorarioMode] = useState<'comum' | 'porDia'>('comum')
  const [horario, setHorario] = useState('')
  const [horariosPorDia, setHorariosPorDia] = useState<Partial<Record<DiaSemana, string>>>({})
  const [observacao, setObservacao] = useState('')
  const [liderUid, setLiderUid] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedElenco, setSavedElenco] = useState<{ nome: string; pessoas: Inscricao[] } | null>(null)

  const defaultDiasRef = useRef(defaultDias)
  defaultDiasRef.current = defaultDias

  useEffect(() => {
    if (!open) return
    setNome('')
    const d = defaultDiasRef.current
    setDias(d && d.length > 0 ? sortDias(d) : [])
    setHorarioMode('comum')
    setHorario('')
    setHorariosPorDia({})
    setObservacao('')
    setLiderUid('')
    setError('')
    setSavedElenco(null)
  }, [open])

  useEffect(() => {
    setLiderUid(prev => (prev && !selectedInscricoes.some(i => i.uid === prev) ? '' : prev))
  }, [selectedInscricoes])

  function toggleDia(dia: DiaSemana) {
    setDias(prev => (prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]))
  }

  function handleClose() {
    onOpenChange(false)
    setSavedElenco(null)
  }

  async function handleSave() {
    if (!nome.trim() || dias.length === 0 || selectedInscricoes.length === 0) {
      setError('Preencha nome, pessoas e dia(s).')
      return
    }
    if (horarioMode === 'comum' && !horario) {
      setError('Preencha o horário.')
      return
    }
    if (horarioMode === 'porDia' && dias.some(d => !horariosPorDia[d])) {
      setError('Preencha o horário de todos os dias selecionados.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const finalNome = nome.trim()
      await createElenco({
        nome: finalNome,
        participantes: selectedInscricoes.map(i => i.uid),
        liderUid: liderUid || undefined,
        dias,
        horario: horarioMode === 'comum' ? horario : undefined,
        horarios: horarioMode === 'porDia' ? Object.fromEntries(dias.map(d => [d, horariosPorDia[d]])) : undefined,
        observacao: observacao.trim() || undefined,
      })
      if (liderUid && (users[liderUid]?.role ?? 'participante') === 'participante') {
        await updateUserRole(liderUid, 'lider')
        onLiderPromoted?.(liderUid)
      }
      setSavedElenco({ nome: finalNome, pessoas: selectedInscricoes })
      onCreated()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={savedElenco ? 'Elenco criado' : 'Cadastrar Elenco'}>
      {savedElenco ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
          </div>
          <div>
            <p className="text-base font-semibold">{savedElenco.nome}</p>
            <p className="text-sm text-emerald-600">Elenco cadastrado com sucesso!</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {savedElenco.pessoas.map(p => (
              <Avatar key={p.uid} photoURL={users[p.uid]?.photoURL} name={p.apelido || p.nomeCompleto} className="h-9 w-9 text-xs" />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Deseja criar uma cena para esse elenco ou vincular a uma cena já criada?</p>
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => navigate('/admin/em-construcao')}>
              Criar cena
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/admin/em-construcao')}>
              Vincular a cena existente
            </Button>
            <Button variant="ghost" className="w-full text-gray-500" onClick={handleClose}>
              Agora não
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="elenco-nome">Nome</Label>
            <Input id="elenco-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Ensaio geral" />
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
            <Label htmlFor="elenco-lider">Líder</Label>
            <Select id="elenco-lider" value={liderUid} onChange={e => setLiderUid(e.target.value)}>
              <option value="">Sem líder definido</option>
              {selectedInscricoes.map(i => (
                <option key={i.uid} value={i.uid}>
                  {i.apelido || i.nomeCompleto}
                </option>
              ))}
            </Select>
            {liderUid && (users[liderUid]?.role ?? 'participante') === 'participante' && (
              <p className="text-xs text-muted-foreground mt-1">Essa pessoa vai virar Líder ao salvar.</p>
            )}
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

          <div>
            <Label>Horário</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5 mb-2">
              <button
                type="button"
                onClick={() => setHorarioMode('comum')}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium transition-colors',
                  horarioMode === 'comum' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                )}
              >
                Horário comum
              </button>
              <button
                type="button"
                onClick={() => setHorarioMode('porDia')}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium transition-colors',
                  horarioMode === 'porDia' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                )}
              >
                Horário por dia
              </button>
            </div>
            {horarioMode === 'comum' ? (
              <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} />
            ) : dias.length === 0 ? (
              <p className="text-xs text-muted-foreground">Selecione ao menos um dia primeiro.</p>
            ) : (
              <div className="space-y-1.5">
                {sortDias(dias).map(d => (
                  <div key={d} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs font-medium text-gray-600">{DIA_SEMANA_LABELS[d]}</span>
                    <Input
                      type="time"
                      value={horariosPorDia[d] ?? ''}
                      onChange={e => setHorariosPorDia(prev => ({ ...prev, [d]: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="elenco-observacao">Observação (opcional)</Label>
            <Input id="elenco-observacao" value={observacao} onChange={e => setObservacao(e.target.value)} />
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
