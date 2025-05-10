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
import { cn } from '@/lib/utils';

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
  const [showSidebar, setShowSidebar] = useState(false);


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
  
    onForegroundMessage((payload) => {
      const title = payload.notification?.title || "Notification";
      const body = payload.notification?.body || "You have a new message";
      const icon = payload.notification?.icon || "/fire.png";
  
      console.log("📩 Foreground message received:", payload);
  
      if (document.hidden) {
        // If tab is inactive, show native browser notification
        console.log('Permission:', Notification.permission);
        if (Notification.permission === "granted") {
          new Notification(title, {
            body,
            icon,
          });
        }
      } else {
        // Tab is active, show toast
        toast.info(body);
      }
    });
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
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Mobile toggle button */}
      <Button
        className=" md:hidden absolute top-0 left-0 z-50"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        {showSidebar ? 'Close' : 'Users'}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "w-64 fixed top-0 left-0 h-full z-40 bg-gray-900 border-r border-white/10 transform transition-transform duration-300 flex flex-col md:static md:translate-x-0",
          showSidebar ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-4 pt-10 shrink-0">
          <h3 className="text-white text-lg font-semibold">Users</h3>
        </div>

        {/* Scrollable user list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          <Collapsible>
            {users.map((u) => (
              <div key={u.uid}>
                <CollapsibleTrigger
                  onClick={() => {
                    setActiveUser(u);
                    setShowSidebar(false);
                  }}
                  className={cn(
                    "flex justify-between items-center px-4 py-2 text-white w-full cursor-pointer",
                    activeUser?.uid === u.uid ? "bg-gray-700" : "hover:bg-gray-700"
                  )}
                >
                  <span className="relative">
                    <span title={u.email}>
                      {u.displayName}
                      <span className="text-[10px] text-gray-400 ml-1">
                        {u.typingTo === user?.uid ? 'is typing...' : ''}
                      </span>
                    </span>
                    {unreadCounts[u.uid] > 0 && (
                      <span className="ml-2 text-xs bg-red-600 text-white rounded-full px-2">
                        {unreadCounts[u.uid]}
                      </span>
                    )}
                  </span>
                  <span className="text-xs">
                    <div className={cn("w-2 h-2 rounded-full", u.isOnline ? 'bg-green-400' : 'bg-red-400')} />
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent />
              </div>
            ))}
          </Collapsible>
        </div>

        {/* Logout fixed to bottom */}
        <div className="shrink-0 p-4 border-t border-white/10">
          <Button variant="destructive" className="!bg-red-700 !text-white w-full" onClick={logout}>
            Log Out
          </Button>
        </div>
      </div>

      {/* Chat interface */}
      <div className="flex-1 p-6 relative flex flex-col md:ml-0 ml-0">
        {activeUser ? (
          <>
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-white text-2xl">Chat with {activeUser.displayName}</h2>
                {typingUserId === activeUser.uid ? (
                  <p className="text-green-400 text-sm mt-3">is typing...</p>
                ) : activeUser.isOnline ? (
                  <p className="text-green-400 text-sm mt-3">Active</p>
                ) : (
                  <p className="text-red-400 text-sm mt-3">Inactive</p>
                )}
              </div>
              <Button className="!bg-red-700 text-white" onClick={() => setActiveUser(null)}>
                Close Chat
              </Button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-800 p-4 rounded-lg">
              {messages.map((msg, i) => (
                <div key={i} className={`mb-2 flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`flex items-end gap-2 rounded-lg p-2 text-sm ${
                      msg.senderId === user?.uid ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <div className="text-[8px] text-right text-gray-300 mt-1">
                      {msg.seen && msg.senderId === user?.uid ? '✓' : ''}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 p-3 bg-gray-700 text-white rounded-lg"
              />
              <Button onClick={sendMessage} className="!bg-green-500 !text-white">
                Send
              </Button>
            </div>
          </>
        ) : (
          <div className="text-white text-xl text-center my-auto">Select a user to start chatting</div>
        )}
      </div>
    </div>
  );
};

export default ChatRoomPage;