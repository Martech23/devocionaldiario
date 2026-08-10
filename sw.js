/* Service Worker — Bíblia Devocional PWA + Web Push */
const CACHE = 'lampada-v36';
const PRECACHE = [
  '/',
  '/index.html',
  '/privacidade.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon-32.png',
  '/favicon-16.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  /* ícones da interface: sem eles no precache, o app instalado abriria
     offline com o microfone e o compartilhar quebrados */
  '/icon-mic.png',
  '/icon-share.png',
  '/icon-speaker.png',
  /* as fontes saíram do Google e vieram para cá: precisam estar no cache,
     senão offline o app cairia na fonte do sistema */
  '/fonts/source-sans-3.woff2',
  '/fonts/source-serif-4.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (
    url.hostname.includes('getbible') ||
    url.hostname.includes('helloao') ||
    url.hostname.includes('bible-api') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Bíblia Devocional · Devocional do dia',
    body: 'Seu encontro diário com a Palavra está pronto.',
    url: '/',
    tag: 'devocional-diario'
  };
  try {
    if (event.data) data = Object.assign({}, data, event.data.json());
  } catch (_) {
    try {
      if (event.data) data.body = event.data.text();
    } catch (__) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'devocional-diario',
      data: { url: data.url || '/' },
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
