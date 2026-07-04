// Subsidy Radar — Service Worker
// Handles offline caching (cache-first for assets, network-first for HTML)
// and push notifications for subsidy deadline reminders.

const CACHE_NAME = 'subsidy-radar-v2';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/subsidy-radar/',
  '/subsidy-radar/index.html',
  '/subsidy-radar/favicon.svg',
  '/subsidy-radar/manifest.json',
  '/subsidy-radar/icons/icon-192.png',
  '/subsidy-radar/icons/icon-512.png',
];

// ─── Install: pre-cache known static assets ───────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// ─── Fetch: cache strategy ──────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only intercept same-origin or subsidy-radar requests
  if (!url.pathname.startsWith('/subsidy-radar')) return;

  // Network-first for HTML navigation (ensures fresh content when online)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/subsidy-radar/')))
    );
    return;
  }

  // Cache-first for static assets (_astro/, icons, data JSON, fonts)
  const isCacheable =
    url.pathname.includes('/_astro/') ||
    url.pathname.includes('/subsidy-radar/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js');

  if (isCacheable) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: '補助雷達提醒', body: '有補助即將截止，快去查看！', url: '/subsidy-radar/' };
  try { Object.assign(data, event.data?.json()); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/subsidy-radar/icons/icon-192.png',
      badge: '/subsidy-radar/favicon.svg',
      tag: 'subsidy-deadline',
      requireInteraction: false,
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/subsidy-radar/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('/subsidy-radar') && 'focus' in client)
          return client.focus().catch(() => clients.openWindow(url));
      }
      return clients.openWindow(url);
    })
  );
});
