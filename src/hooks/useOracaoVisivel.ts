import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

/** Relógio de oração: admin sempre vê; os demais só quando o admin libera (`settings.oracaoLiberada`). */
export function useOracaoVisivel(): boolean {
  const isAdmin = useAuthStore(s => s.user?.role === 'admin')
  const liberada = useSettingsStore(s => !!s.settings.oracaoLiberada)
  return isAdmin || liberada
}
