/* public/firebase-messaging-sw.js */

importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: 'AIzaSyA1jSVPKcuQC5PIAoZQ2G9bL7Ke21tpmsw',
  authDomain: 'firechat-a508c.firebaseapp.com',
  projectId: 'firechat-a508c',
  storageBucket: 'firechat-a508c.firebasestorage.app',
  messagingSenderId: '749271254741',
  appId: '1:749271254741:web:638566e3f7aa0f26e9045c',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);

  const notificationTitle = payload.notification?.title || "New Message";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new message.",
    icon: payload.notification?.icon || "/fire.png",
  };

  console.log("notificationOptions", notificationOptions);
  console.log("notificationTitle", notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});
