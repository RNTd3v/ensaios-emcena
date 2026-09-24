/*
 * Service worker só do push (FCM). Registrado pelo app com escopo próprio
 * (/firebase-cloud-messaging-push-scope), separado do service worker do PWA.
 * Não importa script de fora (o CSP do app bloquearia) — o FCM entrega um Web Push padrão e
 * aqui a gente monta a notificação a partir do `data` que as Cloud Functions mandam
 * (titulo, corpo, link, tipo).
 */
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

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      data: { link },
      tag: data.tipo ? `${data.tipo}-${Date.now()}` : undefined,
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/notificacoes'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
      // Se o app já está aberto numa aba/janela, foca nela e navega; senão abre uma nova.
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate(link).catch(() => {})
          return janela.focus()
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
