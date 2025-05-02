'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useTheme } from "next-themes";
import { collection, getDocs, query, orderBy, addDoc, onSnapshot, doc } from 'firebase/firestore';

const ChatRoomPage = () => {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [user, setUser] = useState(() => auth.currentUser);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme("dark");
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) router.push("/");
    });
    return unsubscribe;
  }, [router, setTheme]);

  useEffect(() => {
    const fetchUsers = async () => {
      const usersCollection = collection(db, "users");
      const userSnapshot = await getDocs(usersCollection);
      const usersList = userSnapshot.docs.map(doc => doc.data());
      setUsers(usersList.filter(u => u.uid !== auth.currentUser?.uid));
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!user || !activeUser) return;

    const chatId = [user.uid, activeUser.uid].sort().join('_');
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data());
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return unsubscribe;
  }, [user, activeUser]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !activeUser) return;

    const chatId = [user.uid, activeUser.uid].sort().join('_');
    const messagesRef = collection(db, "chats", chatId, "messages");

    await addDoc(messagesRef, {
      senderId: user.uid,
      receiverId: activeUser.uid,
      text: newMessage,
      timestamp: new Date(),
    });

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r border-white/10 bg-gray-900">
        <div className="p-4">
          <h3 className="text-white text-lg font-semibold">Users</h3>
        </div>
        <Collapsible>
          {users.map((u) => (
            <div key={u.uid}>
              <CollapsibleTrigger
                onClick={() => setActiveUser(u)}
                className={`flex justify-between items-center px-4 py-2 text-white w-full cursor-pointer ${
                  activeUser?.uid === u.uid ? 'bg-gray-700' : 'hover:bg-gray-700'
                }`}
              >
                <span title={u.email}>{u.displayName}</span>
                <span className={`text-xs ${activeUser?.uid === u.uid ? 'text-green-400' : 'text-red-400'}`}>
                  {activeUser?.uid === u.uid ? 'Active' : 'Inactive'}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent />
            </div>
          ))}
        </Collapsible>
        <div className="mt-auto p-4 flex justify-center">
          <Button variant="destructive" className="!bg-red-700 !text-white" onClick={logout}>Log Out</Button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 p-6 relative flex flex-col">
        {activeUser ? (
          <>
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h2 className="text-white text-2xl">Chat with {activeUser.displayName}</h2>
              <Button variant="destructive" size="sm" onClick={() => setActiveUser(null)}>Close Chat</Button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-800 p-4 rounded-lg">
              {messages.map((msg, i) => (
                <div key={i} className={`mb-2 flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg p-2 ${msg.senderId === user?.uid ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'}`}>
                    {msg.text}
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
              <Button onClick={sendMessage} className="!bg-green-500 !text-white">Send</Button>
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
