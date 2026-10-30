// Service worker de la app de chats: muestra las notificaciones y abre el chat al tocarlas.
// No guarda nada en caché: la app siempre carga la versión publicada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'BE Group', {
    body: d.cuerpo || '',
    tag: d.etiqueta || 'begroup',
    renotify: true,
    icon: '/icono-192.png',
    badge: '/icono-insignia.png',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (new URL(v.url).origin === self.location.origin && 'focus' in v) {
        v.postMessage({ tipo: 'abrir', url });
        return v.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
