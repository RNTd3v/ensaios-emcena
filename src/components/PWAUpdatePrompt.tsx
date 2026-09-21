import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

/**
 * Atualiza sozinho assim que detecta uma nova versão, sem esperar clique do usuário:
 * se o bundle antigo travar antes de renderizar (ex: chave de API quebrada num deploy anterior),
 * o usuário nunca veria um botão "Atualizar" pra clicar.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Sem isso, o navegador só reconfere o service worker em navegações/reloads — num PWA
    // instalado que fica aberto, isso pode nunca acontecer. Checa de tempos em tempos também.
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
  })

  useEffect(() => {
    if (needRefresh) updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-24 sm:bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary px-4 py-3 shadow-xl text-primary-foreground">
        <RefreshCw className="h-4 w-4 shrink-0 opacity-80 animate-spin" />
        <p className="flex-1 text-sm font-medium">Atualizando...</p>
      </div>
    </div>
  )
}
