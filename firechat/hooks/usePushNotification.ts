// hooks/usePushNotification.ts
import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { useAuthState } from 'react-firebase-hooks/auth'; // Correct import for useAuthState hook
import { auth } from '@/lib/firebase'; // Adjust your import path as necessary

const usePushNotification = () => {
  const [user, loading] = useAuthState(auth); // Use useAuthState from react-firebase-hooks
  useEffect(() => {
    if (!loading && user) {
      // Initialize Firebase Messaging
      const messaging = getMessaging(getApp());

      // Function to request permission for notifications
      const requestPermission = async () => {
        try {
          // Check if notification permission has already been granted
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.error('Permission not granted for notifications');
            return;
          }
          console.log("usePushNotification", process.env.NEXT_PUBLIC_FCM_VAPID_KEY);
          // Now that we have permission, get the FCM token
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY, // Your VAPID Key
          });

          if (token) {
            console.log('FCM Token:', token);
            // Send this token to your server to subscribe the user to topics or save for future use
          } else {
            console.log('No FCM token available.');
          }
        } catch (error) {
          console.error('Error getting FCM token:', error);
        }
      };

      // Listen for incoming messages (when the app is in the background or closed)
      onMessage(messaging, (payload) => {
        console.log('Message received: ', payload);
        // Handle notification UI changes or other actions on message reception
      });

      // Request permission for notifications on mount
      requestPermission();

      // Optional: Manually check for token updates periodically
      console.log("usePushNotification", process.env.NEXT_PUBLIC_FCM_VAPID_KEY);
      const interval = setInterval(() => {
        getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
        }).then((newToken) => {
          if (newToken) {
            console.log('Updated FCM Token:', newToken);
            // Send the updated token to your server
          }
        }).catch((error) => {
          console.error('Error fetching updated FCM token:', error);
        });
      }, 3600000); // Check every hour (adjust as needed)

      // Cleanup on unmount
      return () => clearInterval(interval);
    }
  }, [user, loading]);

  return null; // No need to render anything
};

export default usePushNotification;
