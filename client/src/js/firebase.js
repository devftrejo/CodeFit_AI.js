// Single Firebase bootstrap for the client. Every other module that needs
// Auth (or, later, Firestore) imports from here so initializeApp() is called
// exactly once per page load.
//
// The web config is *not* a secret — Firebase security comes from Auth +
// Firestore rules, not from hiding these values. Safe to commit.

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

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

// In dev (Vite serves on localhost), point at the Auth emulator so test
// sign-ups don't pollute real Firebase Auth. In prod (the built bundle),
// import.meta.env.DEV is false and this is skipped.
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
}
