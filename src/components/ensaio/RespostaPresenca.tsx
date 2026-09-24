import { useEffect, useState } from 'react'
import { Check, MessageSquareX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { confirmarPresenca, registrarAusencia, subscribeToMinhaAusencia, uidsAusentes } from '@/services/firebase/ensaios'
import { canCheckin } from '@/lib/agenda'
import type { AusenciaMotivo, Ensaio } from '@/types'

/** Se o horário de início do ensaio já passou. */
export function ensaioJaComecou(ensaio: Pick<Ensaio, 'data' | 'horario'>): boolean {
  return new Date() >= new Date(`${ensaio.data}T${ensaio.horario}:00`)
}

interface Props {
  ensaio: Ensaio
  uid: string
  checkinLimiteHoras: number
}

/**
 * A resposta da própria pessoa pra um ensaio: "Vou" (check-in, só na janela de `canCheckin`) ou
 * "Não vou" com o motivo (a qualquer momento antes do ensaio começar). Dá pra trocar de resposta
 * enquanto o ensaio não começou.
 */
export function RespostaPresenca({ ensaio, uid, checkinLimiteHoras }: Props) {
  const [escrevendoMotivo, setEscrevendoMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [minhaAusencia, setMinhaAusencia] = useState<AusenciaMotivo | null>(null)
  const ausente = uidsAusentes(ensaio).includes(uid)
  useEffect(() => {
    if (!ausente) return setMinhaAusencia(null)
    return subscribeToMinhaAusencia(ensaio.id, uid, setMinhaAusencia)
  }, [ensaio.id, uid, ausente])

  const confirmado = !!ensaio.presencas?.includes(uid)
  // Motivo privado (subcoleção), com fallback pro legado ainda não migrado.
  const ausencia = ausente ? { motivo: minhaAusencia?.motivo ?? ensaio.ausencias?.[uid]?.motivo ?? '' } : undefined
  const podeConfirmar = canCheckin(ensaio.data, ensaio.horario, checkinLimiteHoras)
  const comecou = ensaioJaComecou(ensaio)

  async function run(fn: () => Promise<void>) {
    setSaving(true)
    setError('')
    try {
      await fn()
      setEscrevendoMotivo(false)
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  function abrirMotivo() {
    setMotivo(ausencia?.motivo ?? '')
    setEscrevendoMotivo(true)
  }

  if (escrevendoMotivo) {
    return (
      <div className="space-y-2">
        <Textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Conte o motivo (ex.: trabalho, viagem, doença...)"
          autoFocus
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setEscrevendoMotivo(false)} disabled={saving}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={() => run(() => registrarAusencia(ensaio.id, uid, motivo))}
            disabled={saving || !motivo.trim()}
          >
            {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
            Enviar
          </Button>
        </div>
      </div>
    )
  }

  if (confirmado) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
          <Check className="h-4 w-4" />
          Presença confirmada
        </span>
        {!comecou && (
          <button type="button" onClick={abrirMotivo} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            Não vou mais
          </button>
        )}
      </div>
    )
  }

  if (ausencia) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg bg-red-50 px-3 py-2">
          <p className="flex items-center gap-1 text-sm font-medium text-red-700">
            <X className="h-4 w-4" />
            Você avisou que não vai
          </p>
          {ausencia.motivo && <p className="mt-0.5 whitespace-pre-wrap text-xs text-red-600">{ausencia.motivo}</p>}
          <p className="mt-1 text-[10px] text-red-400">O motivo só aparece pra você, pro líder da cena e pros admins.</p>
        </div>
        {!comecou && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={abrirMotivo} disabled={saving}>
              Editar motivo
            </Button>
            {podeConfirmar && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => run(() => confirmarPresenca(ensaio.id, uid))}
                disabled={saving}
              >
                {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Vou sim
              </Button>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (comecou) return <p className="text-xs text-muted-foreground">Você não respondeu a esse ensaio.</p>

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-red-600" onClick={abrirMotivo} disabled={saving}>
          <MessageSquareX className="h-4 w-4" />
          Não vou
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => run(() => confirmarPresenca(ensaio.id, uid))}
          disabled={saving || !podeConfirmar}
        >
          {saving ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Check className="h-4 w-4" />}
          Vou
        </Button>
      </div>
      {!podeConfirmar && (
        <p className="text-center text-[11px] text-muted-foreground">
          A confirmação abre no dia do ensaio, até {checkinLimiteHoras}h antes do horário.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
