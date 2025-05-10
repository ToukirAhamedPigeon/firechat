'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc, setDoc, getDoc
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { getMessaging, getToken } from 'firebase/messaging';

const HomeClient = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [user, setUser] = useState(() => auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("navigator", navigator);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('SW registered:', registration);
        })
        .catch((err) => {
          console.error('SW registration failed:', err);
        });
    }
  }, []);
  useEffect(() => {
    setTheme("dark");
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
  
      if (firebaseUser) {
        // ✅ Redirect to /chat-room only if not already there
        if (pathname !== "/chat-room") {
          router.push("/chat-room");
        }
      } else {
        // ✅ Redirect to home if logged out and on a protected route
        if (pathname === "/chat-room") {
          console.log("Redirecting to / after logout");
          router.push("/");
        }
      }
    });
    return unsubscribe;
  }, [router, pathname, setTheme]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userUid = user.uid;
    
        const userRef = doc(db, 'users', userUid);
        const userSnap = await getDoc(userRef);
    
        if (userSnap.exists()) {
          console.log('User with this UID already exists.');
          if (typeof window !== "undefined") {
            try {
              const messaging = getMessaging();
              console.log("HomeClient", process.env.NEXT_PUBLIC_FCM_VAPID_KEY);
              const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
              });
          
              if (token) {
                await setDoc(userRef, { fcmToken: token }, { merge: true });
                console.log("✅ FCM token saved:", token);
              } else {
                console.warn("⚠️ FCM token is null");
              }
            } catch (error) {
              console.error("❌ Error getting FCM token:", error);
            }
          }
          return;
        }
    
        // Create a new user document
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL || '',
          lastLogin: new Date(),
        });
      // Fetch and save FCM token (only on client)
      if (typeof window !== "undefined") {
        try {
          const messaging = getMessaging();
          console.log("HomeClient", process.env.NEXT_PUBLIC_FCM_VAPID_KEY);
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
          });
      
          if (token) {
            await setDoc(userRef, { fcmToken: token }, { merge: true });
            console.log("✅ FCM token saved:", token);
          } else {
            console.warn("⚠️ FCM token is null");
          }
        } catch (error) {
          console.error("❌ Error getting FCM token:", error);
        }
      }
    } catch (err) {
      console.error('Error during login:', err);
    }
  };

//   const logout = async () => {
//     const currentUser = auth.currentUser;
  
//     if (currentUser) {
//       const userRef = doc(db, "users", currentUser.uid);
//       try {
//         await updateDoc(userRef, {
//           isOnline: false,
//           lastSeen: serverTimestamp(),
//           fcmToken: deleteField(),
//         });
  
//         // Optional: delete FCM token client-side
//         if (typeof window !== "undefined") {
//           const messaging = getMessaging();
//           await deleteToken(messaging);
//           console.log("FCM token deleted from client");
//         }
//       } catch (error) {
//         console.error("Error during logout cleanup:", error);
//       }
//     }
  
//     // Sign out AFTER all updates
//     await signOut(auth);
//   };

  return (
    <main className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 w-full border-b border-white/10 backdrop-blur-sm bg-transparent">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-end items-center">
          {/* {user ? (
            <Button variant="destructive" className="!bg-red-500 !text-white cursor-pointer" onClick={logout}>
              Logout
            </Button>
          ) : ( */}
            <Button variant="default" className="!bg-blue-500 !text-white cursor-pointer" onClick={login}>
              Sign in with Google
            </Button>
          {/* )} */}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
        {user && <p className="text-white text-lg">Hello, {user.displayName}</p>}
      </div>
    </main>
  );
};

export default HomeClient;
