/* Service Worker — Bíblia Devocional PWA + Web Push */
const CACHE = 'lampada-v71';

/* =========================================================
   O TEXTO BÍBLICO TEM CACHE PRÓPRIO

   Ele mora fora do CACHE do app de propósito. Toda publicação
   troca a versão do CACHE e apaga o anterior — se o texto
   estivesse lá dentro, cada correção de CSS jogaria fora tudo o
   que a pessoa já tinha lido, e ela voltaria a ficar sem Bíblia
   offline sem ter feito nada.

   Versículo não muda. Uma vez guardado, vale para sempre.
   ========================================================= */
const CACHE_BIBLIA = 'lampada-biblia-v1';
/* um capítulo em JSON dá uns 4 KB; 600 são ~2,5 MB, e a Bíblia
   inteira tem 1.189 — cabe quase toda, sem crescer sem limite */
const MAX_BIBLIA = 600;
const PRECACHE = [
  '/',
  '/index.html',
  /* o CSS e o JS saíram de dentro do index.html para a CSP poder recusar
     script e estilo embutidos. Fora do precache, o app instalado abriria
     offline como uma página sem estilo e sem nenhuma função. */
  '/estilo.css',
  '/app.js',
  '/privacidade.html',
  '/privacidade.css',
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
      /* o cache da Bíblia sobrevive à troca de versão do app */
      Promise.all(keys
        .filter((k) => k !== CACHE && k !== CACHE_BIBLIA)
        .map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* =========================================================
   BÍBLIA: DO CACHE PRIMEIRO, SEM REVALIDAR

   Antes o service worker devolvia `return` para todo pedido de
   texto bíblico — deixava passar direto para a rede, sem guardar
   nada. Resultado medido: offline o app abria com estilo e
   nenhuma palavra da Bíblia, e a mensagem mandava apertar F12.

   Aqui é cache-primeiro e ponto. Não há revalidação em segundo
   plano porque não há o que revalidar: o texto de João 3 na
   Bíblia Livre é o mesmo hoje e daqui a um ano. Revalidar
   gastaria dados de quem está no 3G para confirmar o que já se
   sabe.
   ========================================================= */
function ehTextoBiblico(url) {
  return url.hostname.includes('getbible') ||
         url.hostname.includes('helloao') ||
         url.hostname.includes('bible-api');
}

async function podarBiblia(cache) {
  const chaves = await cache.keys();
  if (chaves.length <= MAX_BIBLIA) return;
  /* keys() vem na ordem de inserção: os primeiros são os mais antigos */
  for (const k of chaves.slice(0, chaves.length - MAX_BIBLIA)) {
    await cache.delete(k);
  }
}

async function servirBiblia(req) {
  const cache = await caches.open(CACHE_BIBLIA);
  const guardado = await cache.match(req);
  if (guardado) return guardado;

  const res = await fetch(req);
  if (res && res.ok) {
    await cache.put(req, res.clone());
    /* podar depois de responder seria melhor, mas o await aqui é
       barato: só percorre chaves, e só faz algo passando de 600 */
    podarBiblia(cache);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Conta, sincronização e métricas nunca entram em cache: são
     estado que muda, e servir uma resposta velha de /api/conta
     seria mostrar a sessão de ontem como se fosse a de agora. */
  if (url.pathname.startsWith('/api/')) return;

  if (ehTextoBiblico(url)) {
    event.respondWith(servirBiblia(req));
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
