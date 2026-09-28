import { useEffect, useState } from 'react'
import { diffPartes, parseHorarios } from '@/lib/apresentacoes'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_SETTINGS } from '@/services/firebase/settings'
import { LoginOrnamento } from '@/components/login/LoginOrnamento'

/**
 * Contagem regressiva até a próxima apresentação, na tela de login. Só aparece com a chave
 * "Contagem regressiva no login" ligada em Configurações.
 */
export function LoginContagem() {
  const { settings } = useSettingsStore()
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!settings.loginContagemApresentacao) return null

  const data = settings.eventDate || DEFAULT_SETTINGS.eventDate
  if (!data) return null
  const horarios = parseHorarios(settings.apresentacaoHorarios || DEFAULT_SETTINGS.apresentacaoHorarios)
  const proxima = (horarios.length ? horarios : ['00:00'])
    .map(h => new Date(`${data}T${h}:00`))
    .find(inicio => inicio > agora)
  if (!proxima) return null

  const partes = diffPartes(proxima.getTime() - agora.getTime())

  return (
    <div className="w-full text-center text-white">
      <LoginOrnamento>Contagem para o musical</LoginOrnamento>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {(
          [
            ['dias', partes.dias],
            ['horas', partes.horas],
            ['min', partes.minutos],
            ['seg', partes.segundos],
          ] as const
        ).map(([label, valor]) => (
          <div key={label} className="login-glass rounded-2xl py-2.5">
            <p className="font-display text-[28px] font-bold leading-none tabular-nums">{String(valor).padStart(2, '0')}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
