import { useEffect, useState } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_SETTINGS } from '@/services/firebase/settings'
import { cn } from '@/lib/utils'

function parseHorarios(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(h => h.trim())
    .filter(h => /^\d{1,2}:\d{2}$/.test(h))
    .map(h => h.padStart(5, '0'))
    .sort()
}

function diffPartes(ms: number) {
  const totalSeg = Math.max(0, Math.floor(ms / 1000))
  return {
    dias: Math.floor(totalSeg / 86400),
    horas: Math.floor((totalSeg % 86400) / 3600),
    minutos: Math.floor((totalSeg % 3600) / 60),
    segundos: totalSeg % 60,
  }
}

/**
 * Data das apresentações (Configurações → data do espetáculo e horários) com contagem regressiva
 * até a próxima sessão ainda não começada. Depois da última, mostra só uma mensagem.
 */
export function ApresentacoesCard() {
  const { settings } = useSettingsStore()
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Campo salvo vazio em Configurações não deve sumir com o card — cai no padrão (20/12, 10h e 19h).
  const data = settings.eventDate || DEFAULT_SETTINGS.eventDate
  const horarios = parseHorarios(settings.apresentacaoHorarios || DEFAULT_SETTINGS.apresentacaoHorarios)
  if (!data) return null

  const sessoes = (horarios.length ? horarios : ['00:00']).map(h => ({ horario: h, inicio: new Date(`${data}T${h}:00`) }))
  const proxima = sessoes.find(s => s.inicio > agora)
  const dataFormatada = new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const partes = proxima ? diffPartes(proxima.inicio.getTime() - agora.getTime()) : null

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Apresentações</p>
            <p className="text-xs capitalize text-muted-foreground">{dataFormatada}</p>
          </div>
        </div>

        {horarios.length > 0 && (
          <div className="flex gap-2">
            {sessoes.map(s => {
              const passou = s.inicio <= agora
              const ehProxima = s === proxima
              return (
                <span
                  key={s.horario}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-semibold',
                    ehProxima ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-700',
                    passou && 'text-gray-400 line-through',
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {formatHoraCompacta(s.horario)}
                </span>
              )
            })}
          </div>
        )}

        {partes ? (
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {(
              [
                ['dias', partes.dias],
                ['horas', partes.horas],
                ['min', partes.minutos],
                ['seg', partes.segundos],
              ] as const
            ).map(([label, valor]) => (
              <div key={label} className="rounded-xl bg-gray-50 py-2">
                <p className="font-mono text-xl font-bold tabular-nums text-gray-900">{String(valor).padStart(2, '0')}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm font-medium text-primary">As apresentações já aconteceram. Obrigado por fazer parte!</p>
        )}
      </CardContent>
    </Card>
  )
}
