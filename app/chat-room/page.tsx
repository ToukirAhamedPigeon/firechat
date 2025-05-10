'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useTheme } from "next-themes";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { deleteToken, getMessaging } from "firebase/messaging";
import { deleteField } from "firebase/firestore";
import { onForegroundMessage } from '@/lib/firebase-messaging';
import { requestNotificationPermission } from '@/lib/firebase-messaging';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ChatRoomPage = () => {
  const router = useRouter();
  const { setTheme } = useTheme();

  const [user, setUser] = useState(() => auth.currentUser); // Current logged-in user
  const [activeUser, setActiveUser] = useState<any>(null); // Selected user to chat with
  const [users, setUsers] = useState<any[]>([]); // All users except current user
  const [messages, setMessages] = useState<any[]>([]); // Messages between current user and activeUser
  const [newMessage, setNewMessage] = useState(''); // Input message
  const [typingUserId, setTypingUserId] = useState<string | null>(null); // Track if other user is typing
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref to scroll chat to bottom
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({}); // Track unread message counts

  useEffect(() => {

    requestNotificationPermission();
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
    console.log('Permission:', Notification.permission);
  
    // onForegroundMessage((payload) => {
    //   const title = payload.notification?.title || "Notification";
    //   const body = payload.notification?.body || "You have a new message";
    //   const icon = payload.notification?.icon || "/fire.png";
  
    //   console.log("📩 Foreground message received:", payload);
  
    //   if (document.hidden) {
    //     // If tab is inactive, show native browser notification
    //     console.log('Permission:', Notification.permission);
    //     if (Notification.permission === "granted") {
    //       new Notification(title, {
    //         body,
    //         icon,
    //       });
    //     }
    //   } else {
    //     // Tab is active, show toast
    //     toast.info(body);
    //   }
    // });
  }, []);

   // Load all users except self
   useEffect(() => {
    const usersRef = collection(db, "users");
  
    const unsubscribeUsers = onSnapshot(usersRef, async (snapshot) => {
      const usersList = snapshot.docs.map(doc => doc.data());
      const filteredUsers = usersList.filter(u => u.uid !== auth.currentUser?.uid);
      setUsers(filteredUsers);
  
      // Fetch unread message counts for each user
      const counts: Record<string, number> = {};
  
      for (const u of filteredUsers) {
        const chatId = [auth.currentUser?.uid, u.uid].sort().join('_');
        const messagesRef = collection(db, "chats", chatId, "messages");
  
        const q = query(messagesRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
  
        let unread = 0;
        querySnapshot.forEach(doc => {
          const msg = doc.data();
          if (msg.receiverId === auth.currentUser?.uid && !msg.seen) {
            unread += 1;
          }
        });
  
        if (unread > 0) {
          counts[u.uid] = unread;
        }
      }
  
      setUnreadCounts(counts);
    });
  
    return unsubscribeUsers;
  }, []);

      // Handle auth state and update user online status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        router.push("/");
      } else {
        const userRef = doc(db, "users", firebaseUser.uid);
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      }
    });

    return unsubscribe;
  }, [router, setTheme]);

  // Set user offline before closing tab
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user]);

  // Load chat messages when activeUser is selected
  useEffect(() => {
    if (!user || !activeUser) return;

    const chatId = [user.uid, activeUser.uid].sort().join('_');
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // Scroll to bottom after new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Mark received messages as seen
      const batch = writeBatch(db);
      msgs.forEach((msg: any) => {
        if (msg.receiverId === user.uid && !msg.seen) {
          const msgRef = doc(db, "chats", chatId, "messages", msg.id);
          batch.update(msgRef, { seen: true });
        }
      });
      await batch.commit();
    });

    return unsubscribe;
  }, [user, activeUser]);

  // Send a new message
  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !activeUser) return;
  
    const chatId = [user.uid, activeUser.uid].sort().join('_');
    const messagesRef = collection(db, "chats", chatId, "messages");
  
    // Send the new message to Firestore
    await addDoc(messagesRef, {
      senderId: user.uid,
      receiverId: activeUser.uid,
      text: newMessage.trim(),
      timestamp: new Date(),
      seen: false,
    });
  
    setNewMessage('');
  
    // Now send the notification to the recipient
    await sendPushNotification(activeUser.uid, newMessage.trim());
  };

  const sendPushNotification = async (receiverUid: string, messageText: string) => {
    // Fetch the FCM token of the receiver from your backend or Firestore
    const token = await getFCMToken(receiverUid);
    console.log("FCM Token ", token)
  
    if (!token) {
      console.error("FCM token not found for user", receiverUid);
      return;
    }
  
    const payload = {
      notification: {
        title: "New Message",
        body: messageText,
        icon: "/fire.png", // Optionally add an icon
      },
      token: token, // The receiver's FCM token
    };
  
    // Send a request to your backend to trigger the notification via FCM
    try {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  };

  // Replace this function with the actual way to fetch the token
const getFCMToken = async (userUid: string) => {
  // Fetch the FCM token of the recipient (for example from Firestore or backend)
  const userRef = doc(db, "users", userUid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  return userData?.fcmToken; // Assuming you store the FCM token in Firestore
};

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  // Update typingTo field when typing
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const typingTo = newMessage.trim() ? activeUser?.uid : null;
        await updateDoc(userRef, { typingTo });
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [newMessage, activeUser, user]);

  // Clear typingTo on unmount
  useEffect(() => {
    return () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        updateDoc(userRef, { typingTo: null }).catch((err) =>
          console.warn("Could not clear typingTo:", err.message)
        );
      }
    };
  }, []);

  // Show typing indicator when activeUser is typing
  useEffect(() => {
    if (!activeUser) return;
    const activeUserRef = doc(db, "users", activeUser.uid);
    const unsubscribe = onSnapshot(activeUserRef, (docSnap) => {
      const data = docSnap.data();
      if (data?.typingTo === user?.uid) {
        setTypingUserId(activeUser.uid);
      } else {
        setTypingUserId(null);
      }
    });
    return unsubscribe;
  }, [activeUser, user]);


  // Logout logic
  const logout = async () => {
    const currentUser = auth.currentUser;
  
    if (currentUser) {
      const userRef = doc(db, "users", currentUser.uid);
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
          // fcmToken: deleteField(),
        });
  
        // // Optional: delete FCM token client-side
        // if (typeof window !== "undefined") {
        //   const messaging = getMessaging();
        //   await deleteToken(messaging);
        //   console.log("FCM token deleted from client");
        // }
      } catch (error) {
        console.error("Error during logout cleanup:", error);
      }
    }
    // Sign out AFTER all updates
    await signOut(auth);
    router.push("/");
  };

  useEffect(() => {
      if (!user) return;
    
      const unsubscribes: (() => void)[] = [];
    
      users.forEach((otherUser) => {
        const chatId = [user.uid, otherUser.uid].sort().join('_');
        const messagesRef = collection(db, "chats", chatId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));
    
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const unread = snapshot.docs.filter(doc =>
            doc.data().receiverId === user.uid && !doc.data().seen
          ).length;
    
          setUnreadCounts((prev) => ({ ...prev, [otherUser.uid]: unread }));
        });
    
        unsubscribes.push(unsubscribe);
      });
    
      return () => {
        unsubscribes.forEach(unsub => unsub());
      };
    }, [user, users]);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Sidebar / User List */}
      <aside className="md:w-1/3 w-full md:block border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        {/* Collapsible on mobile */}
        <Collapsible>
          <CollapsibleTrigger className="md:hidden p-4 text-left font-semibold">Users</CollapsibleTrigger>
          <CollapsibleContent className="p-4 space-y-2">
            {users.map((u) => (
              <button
                key={u.uid}
                className={`w-full text-left p-2 rounded ${activeUser?.uid === u.uid ? 'bg-blue-100 dark:bg-blue-800' : ''}`}
                onClick={() => setActiveUser(u)}
              >
                {u.name} {unreadCounts[u.uid] ? `(${unreadCounts[u.uid]})` : ''}
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </aside>

      {/* Chat Section */}
      <main className="flex-1 flex flex-col h-full">
        {activeUser ? (
          <>
            <header className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">{activeUser.name}</h2>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] p-2 rounded-lg text-sm ${
                    msg.senderId === user?.uid ? 'bg-blue-500 text-white self-end ml-auto' : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white self-start mr-auto'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUserId === activeUser.uid && (
              <div className="text-sm text-gray-500 px-4">Typing...</div>
            )}

            {/* Input */}
            <footer className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 rounded-md border px-4 py-2 text-sm dark:bg-gray-800 dark:text-white"
                />
                <Button onClick={sendMessage} className="shrink-0">Send</Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a user to start chatting.
          </div>
        )}
      </main>
    </div>
  );
};

export default ChatRoomPage;
