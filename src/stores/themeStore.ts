import { create } from 'zustand'

export type Tema = 'claro' | 'escuro' | 'sistema'

const STORAGE_KEY = 'tema'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function lerTema(): Tema {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'claro' || v === 'escuro' || v === 'sistema') return v
  } catch {
    // storage bloqueado (aba anônima etc.): segue o sistema
  }
  return 'sistema'
}

/** Liga/desliga a classe `.dark` no <html>. O index.html faz o mesmo antes do React, pra não piscar. */
function aplicar(tema: Tema) {
  const escuro = tema === 'escuro' || (tema === 'sistema' && media.matches)
  document.documentElement.classList.toggle('dark', escuro)
}

interface ThemeState {
  tema: Tema
  setTema: (tema: Tema) => void
}

export const useThemeStore = create<ThemeState>(set => ({
  tema: lerTema(),
  setTema: tema => {
    try {
      localStorage.setItem(STORAGE_KEY, tema)
    } catch {
      // sem persistência: vale só nesta sessão
    }
    aplicar(tema)
    set({ tema })
  },
}))

aplicar(useThemeStore.getState().tema)
// No modo "sistema", acompanha a troca do aparelho sem precisar recarregar.
media.addEventListener('change', () => {
  if (useThemeStore.getState().tema === 'sistema') aplicar('sistema')
})
