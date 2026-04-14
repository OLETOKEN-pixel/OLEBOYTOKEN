const FALLBACK_URL = '/';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function resolveNotificationUrl(notification) {
  const data = notification && notification.data ? notification.data : {};
  const rawUrl = typeof data.url === 'string' ? data.url : FALLBACK_URL;

  try {
    return new URL(rawUrl, self.location.origin).href;
  } catch {
    return new URL(FALLBACK_URL, self.location.origin).href;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = resolveNotificationUrl(event.notification);

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windowClients) {
      const clientUrl = new URL(client.url);
      const target = new URL(targetUrl);

      if (clientUrl.origin !== target.origin) {
        continue;
      }

      if ('navigate' in client && clientUrl.pathname !== target.pathname) {
        await client.navigate(targetUrl);
      }

      if ('focus' in client) {
        await client.focus();
      }

      return;
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
