// Thin wrappers around the Firebase Auth API. Other modules consume these
// instead of importing from "firebase/auth" directly, so we have a single
// place to change behavior (e.g., to add error mapping or analytics later).

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "./firebase.js";

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Returns null if signed out, otherwise a fresh ID token (auto-refreshed by
// the SDK when nearing expiry).
export async function getIdToken() {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
