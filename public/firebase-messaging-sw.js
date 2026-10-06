/*
 * Service worker só do push (FCM). Registrado pelo app com escopo próprio
 * (/firebase-cloud-messaging-push-scope), separado do service worker do PWA.
 * Não importa script de fora (o CSP do app bloquearia) — o FCM entrega um Web Push padrão e
 * aqui a gente monta a notificação a partir do `data` que as Cloud Functions mandam
 * (titulo, corpo, link, tipo, nid). Depois de mostrar, confirma o recebimento (`nid` = id da
 * notificação) pra tela "Entrega de notificações" do admin — e de novo no clique, se a primeira
 * confirmação não tiver saído.
 */

/** Avisa o servidor que a notificação `nid` chegou nesse aparelho. */
function confirmarRecebimento(nid, origem) {
  if (!nid) return Promise.resolve()
  return fetch('/api/push-recebido', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: `${nid} ${origem}` }).catch(() => {})
}

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const data = payload.data || {}
  const notification = payload.notification || {}
  const titulo = data.titulo || notification.title || 'Musical Vila Esperança'
  const corpo = data.corpo || notification.body || ''
  const link = data.link || '/notificacoes'

  const mostrar = self.registration.showNotification(titulo, {
    body: corpo,
    icon: '/web-app-manifest-192x192.png',
    badge: '/favicon-96x96.png',
    data: { link, nid: data.nid },
    tag: data.tipo ? `${data.tipo}-${Date.now()}` : undefined,
  })
  event.waitUntil(Promise.all([mostrar, confirmarRecebimento(data.nid, 'chegada')]))
})

/** Página pendente pro app abrir (lida pelo app ao voltar pra frente — ver AbrirLinkDoPush). */
const CACHE_LINK = 'push-link'

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const dados = event.notification.data || {}
  // Só o caminho: o app pode estar aberto em outro domínio do Firebase (web.app / firebaseapp.com).
  const url = new URL(dados.link || '/notificacoes', self.location.origin)
  const caminho = url.pathname + url.search

  event.waitUntil(
    Promise.all([
      confirmarRecebimento(dados.nid, 'clique'),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async janelas => {
        const janela = janelas.find(j => 'focus' in j)
        if (!janela) return self.clients.openWindow(caminho)
        // `navigate()` não serve: só funciona pro service worker que controla a página (o do PWA,
        // não este). Então o app é quem navega: por mensagem (app ativo) e, se ela se perder
        // (iPhone acordando o app), pela página guardada no cache, que o app confere ao voltar.
        try {
          const cache = await caches.open(CACHE_LINK)
          await cache.put('/link', new Response(JSON.stringify({ caminho, em: Date.now() })))
        } catch {
          // sem Cache Storage — fica só a mensagem
        }
        janela.postMessage({ tipo: 'abrir-link', caminho })
        return janela.focus()
      }),
    ]),
  )
})
