self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const buildNotificationPayload = (payload = {}) => {
  const title = payload.title || 'LinkUp';
  const options = {
    body: payload.options?.body || '',
    tag: payload.options?.tag || 'linkup-notification',
    data: payload.options?.data || {},
    icon: payload.options?.icon || '/icon-192.png',
    badge: payload.options?.badge || '/icon-192.png',
    requireInteraction: Boolean(payload.options?.requireInteraction),
    vibrate: Array.isArray(payload.options?.vibrate) ? payload.options.vibrate : [200, 100, 200],
  };

  return { title, options };
};

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_NOTIFICATION') {
    return;
  }

  const { title, options } = buildNotificationPayload(event.data.payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('push', (event) => {
  const rawPayload = (() => {
    if (!event.data) {
      return {};
    }

    try {
      return event.data.json();
    } catch (error) {
      return {
        title: 'LinkUp',
        options: {
          body: event.data.text(),
        },
      };
    }
  })();

  const { title, options } = buildNotificationPayload(rawPayload);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            payload: event.notification?.data || {},
          });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
