import { useEffect, useState } from 'react'
import { Clock, MapPin } from 'lucide-react'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { useSettingsStore } from '@/stores/settingsStore'
import { LoginOrnamento } from '@/components/login/LoginOrnamento'

function diasAte(data: string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${data}T00:00:00`).getTime() - hoje.getTime()) / 86400000)
}

/** Sem horário de término, conta que dura 2h (só pra saber quando parar de mostrar "agora"). */
const DURACAO_PADRAO_MIN = 120

function minutosDe(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m || 0)
}

type Momento = { tipo: 'antes'; dias: number } | { tipo: 'hoje' } | { tipo: 'agora' } | { tipo: 'acabou' }

/** Em que pé está o evento agora: dias antes, hoje (antes do início), acontecendo, ou já acabou. */
function momentoDoEvento(data: string, hora: string | undefined, horaFim: string | undefined, agora: Date): Momento {
  const dias = diasAte(data)
  if (dias < 0) return { tipo: 'acabou' }
  if (dias > 0) return { tipo: 'antes', dias }
  if (!hora) return { tipo: 'hoje' }
  const minutos = agora.getHours() * 60 + agora.getMinutes()
  const inicio = minutosDe(hora)
  const fim = horaFim ? minutosDe(horaFim) : inicio + DURACAO_PADRAO_MIN
  if (minutos < inicio) return { tipo: 'hoje' }
  if (minutos < fim) return { tipo: 'agora' }
  return { tipo: 'acabou' }
}

function textoMomento(m: Momento, hora: string | undefined): string {
  if (m.tipo === 'agora') return 'Acontecendo agora'
  if (m.tipo === 'hoje') return hora ? `É hoje, às ${formatHoraCompacta(hora)}!` : 'É hoje!'
  if (m.tipo === 'antes' && m.dias === 1) return 'É amanhã'
  if (m.tipo === 'antes') return `Faltam ${m.dias} dias`
  return ''
}

/** Re-renderiza a cada minuto — a tela de login pode ficar aberta (ex.: no telão) virando o dia/horário. */
function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return agora
}

/**
 * Bloco "Vem aí" da tela de login (Configurações → Tela de login), no estilo de convite: folhinha
 * de calendário com a data + título em serifada. No dia: "É hoje, às 16h!" até o início,
 * "Acontecendo agora" até o término, e some quando acaba — pra não ficar anúncio velho no ar.
 */
export function LoginDestaque() {
  const { settings } = useSettingsStore()
  const {
    loginDestaqueTitulo: titulo,
    loginDestaqueData: data,
    loginDestaqueHora: hora,
    loginDestaqueHoraFim: horaFim,
    loginDestaqueLocal: local,
  } = settings
  const agora = useAgora()

  if (!titulo?.trim()) return null
  const momento = data ? momentoDoEvento(data, hora, horaFim, agora) : null
  if (momento?.tipo === 'acabou') return null

  const dataObj = data ? new Date(`${data}T00:00:00`) : null
  const semana = dataObj?.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const mes = dataObj?.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

  return (
    <div className="login-glass w-full overflow-hidden rounded-3xl px-5 pb-5 pt-4 text-white">
      <LoginOrnamento>Vem aí</LoginOrnamento>

      <div className="mt-4 flex items-center gap-4">
        {dataObj && (
          <div className="w-[68px] shrink-0 overflow-hidden rounded-2xl bg-[#fff] text-center shadow-lg shadow-black/30">
            <p className="bg-[#7b467f] py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">{semana}</p>
            <p className="font-display pt-1 text-[32px] font-bold leading-none text-[#1c1620]">
              {String(dataObj.getDate()).padStart(2, '0')}
            </p>
            <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b467f]">{mes}</p>
          </div>
        )}

        <div className="min-w-0 text-left">
          <p className="font-display text-xl font-semibold leading-tight">{titulo}</p>
          {(hora || local) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
              {hora && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatHoraCompacta(hora)}
                  {horaFim && ` às ${formatHoraCompacta(horaFim)}`}
                </span>
              )}
              {local && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {local}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {momento && (
        <div className="mt-4 flex justify-center">
          <span className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6ee7b7] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6ee7b7]" />
            </span>
            {textoMomento(momento, hora)}
          </span>
        </div>
      )}
    </div>
  )
}
