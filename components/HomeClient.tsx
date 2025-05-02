'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase"; // Import Firestore (db) along with auth
import { doc, setDoc, getDocs, collection, query, where } from "firebase/firestore"; // Firestore functions for querying and saving
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

const HomeClient = () => {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [user, setUser] = useState(() => auth.currentUser);

  useEffect(() => {
    setTheme("dark");
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        router.push("/chat-room");
      }
    });
    return unsubscribe;
  }, [router, setTheme]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Sign in the user with Google
      const result = await signInWithPopup(auth, provider);
      
      const user = result.user;
      const userEmail = user.email;
  
      // Check if the email is already in Firestore
      const usersCollection = collection(db, "users");
      const q = query(usersCollection, where("email", "==", userEmail));
      const userSnapshot = await getDocs(q);
  
      if (!userSnapshot.empty) {
        // If user already exists in Firestore, handle the duplicate email case
        console.log("User with this email already exists.");
        alert("A user with this email already exists. Please log in.");
        return; // Exit the function, preventing the sign-up process
      }
  
      // If no user with this email, proceed with saving user data to Firestore
      const userRef = doc(db, "users", user.uid); // Reference to the user's document in Firestore
  
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: userEmail,
        photoURL: user.photoURL || "", // Photo URL might not be present
        lastLogin: new Date(),
      });
  
      console.log("User saved to Firestore:", user.displayName);
      
    } catch (err) {
      console.error("Error during login:", err);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Sticky Transparent Top Bar */}
      <div className="sticky top-0 z-50 w-full border-b border-white/10 backdrop-blur-sm bg-transparent">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-end items-center">
          {user ? (
            <Button variant="destructive" className="!bg-red-500 !text-white cursor-pointer" onClick={logout}>
              Logout
            </Button>
          ) : (
            <Button variant="default" className="!bg-blue-500 !text-white cursor-pointer" onClick={login}>
              Sign in with Google
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
        {user && <p className="text-white text-lg">Hello, {user.displayName}</p>}
      </div>
    </main>
  );
};

export default HomeClient;
