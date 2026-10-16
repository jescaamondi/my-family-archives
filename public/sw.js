/* global clients */
self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {
        title: "Family Archive",
        body: event.data?.text() || "You have a new family reminder.",
      };
    }
  })();

  const title = data.title || "Family Archive";
  const options = {
    body: data.body || "You have a new family reminder.",
    icon: "/family-archive-icon.png",
    badge: "/family-archive-icon.png",
    data: {
      url: data.url || "/",
      milestoneId: data.milestoneId || null,
      reminderId: data.reminderId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
