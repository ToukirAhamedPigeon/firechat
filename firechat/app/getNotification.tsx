'use client'
import { useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/firebase-messaging";

export default function GetNotification() {
  useEffect(() => {
    // Ask for permission and register service worker + FCM
    requestNotificationPermission();

    // Handle foreground messages
    onForegroundMessage((payload) => {
      console.log("Message received in foreground", payload);
      const message = payload.notification?.body ?? "You have a new message!";
      const title = payload.notification?.title ?? "Notification";

      if (document.hidden) {
        // If tab is inactive, show native notification
        console.log("Notification.permission", Notification.permission);
        if (Notification.permission === "granted") {
          const notification = new Notification(title, {
            body: message,
            icon: payload.notification?.icon ?? "/fire.png",
          });

          notification.onclick = () => {
            console.log("Notification clicked");
            // Optional: focus the tab or redirect
            window.focus();
          };
        }
      } else {
        // If tab is active, show toast
        toast.info(message);
      }
    });
  }, []);

  return <ToastContainer />;
}
