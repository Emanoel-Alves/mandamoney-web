self.addEventListener('push', (event) => {
  if (!event.data) return;
  const message = event.data.json();
  const title = typeof message.title === 'string' ? message.title : 'Manda Money';
  const options = {
    body: typeof message.body === 'string' ? message.body : '',
    icon: new URL('apple-touch-icon.png', self.registration.scope).href,
    tag: typeof message.tag === 'string' ? message.tag : 'mandamoney-notification',
    data: { url: typeof message.url === 'string' ? message.url : './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.registration.scope);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const windowClient of windows) {
      if (new URL(windowClient.url).origin !== target.origin) continue;
      const focusedClient = await windowClient.focus();
      if (typeof focusedClient.navigate === 'function') await focusedClient.navigate(target.href);
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
