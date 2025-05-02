'use client'

import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useEffect, useState } from "react";

export default function AuthButton() {
  const [user, setUser] = useState(() => auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <div className="p-4">
      {user ? (
        <>
          <p className="mb-2">Hello, {user.displayName}</p>
          <button onClick={logout} className="px-4 py-2 bg-red-500 text-white rounded">
            Sign Out
          </button>
        </>
      ) : (
        <button onClick={login} className="px-4 py-2 bg-blue-500 text-white rounded">
          Sign in with Google
        </button>
      )}
    </div>
  );
}
