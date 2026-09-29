import { create } from 'zustand'

/** Evento do Chrome/Edge (Android e desktop) que permite abrir o "Instalar app" pelo nosso botão. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstalacaoState {
  /** Presente quando o navegador deixa instalar por botão (o evento chega uma vez, cedo). */
  convite: BeforeInstallPromptEvent | null
  instalado: boolean
}

export function rodandoInstalado(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export const useInstalacaoStore = create<InstalacaoState>(() => ({ convite: null, instalado: rodandoInstalado() }))

/**
 * Chamado no main.tsx, antes do React: o `beforeinstallprompt` dispara logo no carregamento e,
 * se ninguém estiver ouvindo, se perde.
 */
export function ouvirInstalacao() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault() // sem o mini-banner do Chrome — o convite é o nosso card
    useInstalacaoStore.setState({ convite: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => useInstalacaoStore.setState({ convite: null, instalado: true }))
}

/** Abre o "Instalar app" do navegador. `true` = a pessoa aceitou. */
export async function instalarApp(): Promise<boolean> {
  const { convite } = useInstalacaoStore.getState()
  if (!convite) return false
  await convite.prompt()
  const { outcome } = await convite.userChoice
  useInstalacaoStore.setState({ convite: null })
  return outcome === 'accepted'
}

export function ehIPhone(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
