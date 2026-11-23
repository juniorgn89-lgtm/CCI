// Avisos no celular (Web Push) do Visor360. Importado pelo service worker gerado
// pelo vite-plugin-pwa (workbox.importScripts em vite.config.ts).

// Aviso chegou: sempre mostra na barra, mesmo com o app aberto.
self.addEventListener('push', (event) => {
  let d
  try { d = event.data ? event.data.json() : {} } catch { d = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(d.title || 'Visor360', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/brand/visor360-icon-192.png',
    badge: '/brand/visor360-icon-192.png',
    lang: 'pt-BR',
    data: { url: d.url || '/' },
  }))
})

// Toque no aviso: traz o app para frente na tela certa (ou abre).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  event.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of abertas) {
      if (new URL(c.url).origin !== self.location.origin) continue
      await c.focus()
      // O app escuta esta mensagem e navega sem recarregar.
      c.postMessage({ tipo: 'visor-abrir', url: destino.pathname + destino.search })
      return
    }
    await self.clients.openWindow(destino.href)
  })())
})
