import { create } from 'zustand'
import { DEFAULT_SETTINGS, getSettings } from '@/services/firebase/settings'
import type { AppSettings } from '@/types'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  refresh: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>(set => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  refresh: async () => {
    try {
      const settings = await getSettings()
      set({ settings, loaded: true })
    } catch (err) {
      console.error('[settings] Falha ao carregar configurações, usando padrão:', err)
      set({ loaded: true })
    }
  },
}))
