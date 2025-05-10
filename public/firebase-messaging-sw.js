importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js");

// Initialize Firebase
firebase.initializeApp({
  apiKey: 'AIzaSyA1jSVPKcuQC5PIAoZQ2G9bL7Ke21tpmsw',
  authDomain: 'firechat-a508c.firebaseapp.com',
  projectId: 'firechat-a508c',
  storageBucket: 'firechat-a508c.firebasestorage.app',
  messagingSenderId: '749271254741',
  appId: '1:749271254741:web:638566e3f7aa0f26e9045c',
});

const messaging = firebase.messaging();

// Show Notification Helper
const showNotification = (title, options = {}) => {
  if (!title) {
    console.error('[SW] Notification title missing');
    return Promise.reject('Notification title is required');
  }

  const notificationOptions = {
    body: options.body || 'You have a new notification',
    icon: options.icon || '/fire.png',
    badge: options.badge || '/fire.png',
    image: options.image,
    data: options.data || {},
    vibrate: [200, 100, 200],
    actions: options.actions || [],
  };

  console.log('[SW] Displaying notification:', title, notificationOptions);

  return self.registration.showNotification(title, notificationOptions)
    .then(() => console.log('[SW] Notification shown successfully'))
    .catch(err => console.error('[SW] Error showing notification:', err));
};

// Handle Background Messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message', payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'Notification';
  const body = notification.body || data.body || 'You have a new message';
  const icon = notification.icon || data.icon || '/fire.png';
  const image = notification.image || data.image;

  return showNotification(title, {
    body,
    icon,
    image,
    data,
  });
});

// Handle Notification Clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || notificationData.click_action || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Lifecycle Events
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
  self.skipWaiting(); // Force activate immediately
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
});
