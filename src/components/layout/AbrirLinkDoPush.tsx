import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const CACHE_LINK = 'push-link'
/** Clique mais antigo que isso não navega mais (o app foi aberto por outro motivo depois). */
const VALIDADE_MS = 2 * 60 * 1000

/**
 * Leva pra página da notificação clicada quando o app já estava aberto. O service worker do push
 * não consegue navegar a janela (não é ele que controla a página — ver public/firebase-messaging-sw.js),
 * então manda uma mensagem e deixa a página guardada no cache; aqui o app navega pelo que chegar
 * primeiro e apaga o pendente.
 */
export function AbrirLinkDoPush() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    async function lerPendente(): Promise<{ caminho: string; em: number } | null> {
      try {
        if (!('caches' in window) || !(await caches.has(CACHE_LINK))) return null
        const resp = await (await caches.open(CACHE_LINK)).match('/link')
        await caches.delete(CACHE_LINK)
        return resp ? ((await resp.json()) as { caminho: string; em: number }) : null
      } catch {
        return null
      }
    }

    function ir(caminho: unknown) {
      if (typeof caminho === 'string' && caminho.startsWith('/')) navigate(caminho)
    }

    async function conferirPendente() {
      const pendente = await lerPendente()
      if (pendente && Date.now() - pendente.em < VALIDADE_MS) ir(pendente.caminho)
    }

    function aoReceber(e: MessageEvent) {
      if (e.data?.tipo !== 'abrir-link') return
      // Já navega pela mensagem: descarta o pendente pra não navegar de novo ao voltar pra frente.
      caches?.delete(CACHE_LINK).catch(() => {})
      ir(e.data.caminho)
    }

    function aoVoltar() {
      if (document.visibilityState === 'visible') conferirPendente()
    }

    navigator.serviceWorker.addEventListener('message', aoReceber)
    navigator.serviceWorker.startMessages()
    document.addEventListener('visibilitychange', aoVoltar)
    conferirPendente()
    return () => {
      navigator.serviceWorker.removeEventListener('message', aoReceber)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [navigate])

  return null
}
