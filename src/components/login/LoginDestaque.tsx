import { Clock, MapPin } from 'lucide-react'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { useSettingsStore } from '@/stores/settingsStore'
import { LoginOrnamento } from '@/components/login/LoginOrnamento'

function diasAte(data: string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${data}T00:00:00`).getTime() - hoje.getTime()) / 86400000)
}

function textoFaltam(dias: number): string {
  if (dias <= 0) return 'É hoje!'
  if (dias === 1) return 'É amanhã'
  return `Faltam ${dias} dias`
}

/**
 * Bloco "Vem aí" da tela de login (Configurações → Tela de login), no estilo de convite: folhinha
 * de calendário com a data + título em serifada. Some sozinho no dia seguinte ao evento, pra não
 * ficar anúncio velho no ar.
 */
export function LoginDestaque() {
  const { settings } = useSettingsStore()
  const { loginDestaqueTitulo: titulo, loginDestaqueData: data, loginDestaqueHora: hora, loginDestaqueLocal: local } = settings

  if (!titulo?.trim()) return null
  const dias = data ? diasAte(data) : null
  if (dias !== null && dias < 0) return null

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

      {dias !== null && (
        <div className="mt-4 flex justify-center">
          <span className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6ee7b7] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6ee7b7]" />
            </span>
            {textoFaltam(dias)}
          </span>
        </div>
      )}
    </div>
  )
}
