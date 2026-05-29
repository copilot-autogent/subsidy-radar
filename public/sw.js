// Subsidy Radar — Service Worker
// Handles PWA push notifications for subsidy deadline reminders.
const CACHE_NAME = 'subsidy-radar-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

self.addEventListener('push', event => {
  let data = { title: '補助雷達提醒', body: '有補助即將截止，快去查看！', url: '/subsidy-radar/' };
  try { Object.assign(data, event.data?.json()); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/subsidy-radar/favicon.svg',
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
