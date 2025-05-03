// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
<<<<<<< HEAD
=======
import { getMessaging, isSupported, Messaging } from "firebase/messaging"; 
>>>>>>> e4008b3 (Al)

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

<<<<<<< HEAD
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
=======
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
/**
 * Use this to get Firebase Messaging only if supported.
 * Usage: const messaging = await getFirebaseMessaging();
 */
export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
  };
>>>>>>> e4008b3 (Al)
