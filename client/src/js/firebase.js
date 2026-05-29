// Single Firebase bootstrap for the client. Every other module that needs
// Auth (or, later, Firestore) imports from here so initializeApp() is called
// exactly once per page load.
//
// The web config is *not* a secret — Firebase security comes from Auth +
// Firestore rules, not from hiding these values. Safe to commit.

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDOLg5HNvTRG7ljFo_DzFBtUHD5KLJG3i0",
  authDomain: "codefit-ai-js.firebaseapp.com",
  projectId: "codefit-ai-js",
  storageBucket: "codefit-ai-js.firebasestorage.app",
  messagingSenderId: "816242909585",
  appId: "1:816242909585:web:312946443f37e727593a30",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// In dev (Vite serves on localhost), point at the emulators so test data
// doesn't touch real Firebase. In prod (the built bundle), import.meta.env.DEV
// is false and these are skipped. Firestore runs on 8085 (not its 8080 default)
// to avoid colliding with the Vite dev server — see firebase.json emulators.
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
}
