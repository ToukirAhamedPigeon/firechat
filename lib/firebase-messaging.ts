'use client';

import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { app } from './firebase';

let messaging: Messaging | null = null;

const initMessaging = async (): Promise<Messaging | null> => {
  // Skip on server-side
  if (typeof window === 'undefined') return null;

  // Check browser support
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser');
    return null;
  }

  // Initialize messaging if not already done
  if (!messaging) {
    messaging = getMessaging(app);
  }

  return messaging;
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    // Skip on server-side
    if (typeof window === 'undefined') return null;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    console.log('Notification permission granted');

    // Initialize messaging
    const msg = await initMessaging();
    if (!msg) return null;

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
      type: 'module'
    });
    console.log('Service Worker registered:', registration);

    // Get FCM token
    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
    return null;
  }
};

export const onForegroundMessage = async (callback: (payload: any) => void): Promise<void> => {
  try {
    const msg = await initMessaging();
    if (msg) {
      onMessage(msg, callback);
    }
  } catch (error) {
    console.error('Error in onForegroundMessage:', error);
  }
};

// Utility to check current token
export const getCurrentToken = async (): Promise<string | null> => {
  try {
    const msg = await initMessaging();
    if (!msg) return null;

    return await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY
    });
  } catch (error) {
    console.error('Error getting current token:', error);
    return null;
  }
};