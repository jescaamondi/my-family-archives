self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: 'Family Archive', body: event.data?.text() || 'You have a family reminder.' }; }
  const title = data.title || 'Family Archive';
  const options = {
    body: data.body || 'You have a family milestone reminder.',
    icon: '/family-archive-icon.png',
    badge: '/family-archive-icon.png',
    tag: data.tag || 'family-archive-reminder',
    renotify: true,
    data: { url: data.url || '/?page=milestones', reminderId: data.reminderId || null }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/?page=milestones';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) { client.navigate(url); return client.focus(); }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
