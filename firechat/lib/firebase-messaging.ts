'use client';

import { getMessaging, getToken, isSupported, onMessage, Messaging } from 'firebase/messaging';
import { app } from './firebase';

let messaging: Messaging | null = null;

const initMessaging = async () => {
  if (typeof window === 'undefined') return null;

  const supported = await isSupported();
  if (!supported) {
    console.warn('🚫 Firebase Messaging is not supported in this browser.');
    return null;
  }

  if (!messaging) {
    messaging = getMessaging(app);
  }

  return messaging;
};

export const requestNotificationPermission = async () => {
  try {
    if (typeof window === 'undefined') return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('🚫 Notification permission not granted.');
      return;
    }

    console.log('✅ Notification permission granted.');
    const msg = await initMessaging();
    if (!msg) return;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log("firebase-messaging.ts", process.env.NEXT_PUBLIC_FCM_VAPID_KEY);
    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log('📲 FCM Token:', token);
    return token;
  } catch (err) {
    console.error('❌ Error getting FCM token:', err);
  }
};

export const onForegroundMessage = async (callback: (payload: any) => void) => {
  const msg = await initMessaging();
  if (msg) {
    onMessage(msg, callback);
  }
};
