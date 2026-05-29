// User profile (app-only). Two jobs:
//   1. Render the signed-in user's identity (name + avatar) in the navbar
//      header, sourced from Firebase Auth — Google sign-in populates
//      displayName/photoURL; email/password falls back to the email's
//      local-part and the placeholder avatar already in the markup.
//   2. Sync preferences to users/{uid}: `preferredRole` (the AI role the user
//      last explicitly chose) and `theme` (light/dark), so they follow the
//      user across devices. Applied on load, persisted on change.
//
// The profile doc is plain client read/write under the owner rule — no Cloud
// Function involved. Loaded after auth (entries/app.js), so currentUser is set.

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { db, auth } from "./firebase.js";
import { getTheme, setTheme } from "./theme.js";
import { setRole } from "./chat.js";

const user = auth.currentUser;

// Mirrors of what's persisted, so a programmatic apply (or an unchanged value)
// doesn't write straight back to Firestore.
let savedRole = null;
let savedTheme = null;

function profileRef() {
  return doc(db, "users", user.uid);
}

function renderIdentity() {
  const nameEl = document.getElementById("username");
  const avatarEl = document.querySelector(".user-profile img");

  const name =
    user.displayName ||
    (user.email ? user.email.split("@")[0] : null) ||
    "Coder";
  if (nameEl) nameEl.textContent = name;

  if (avatarEl && user.photoURL) {
    // Fall back to the bundled placeholder if the remote photo fails to load.
    const placeholder = avatarEl.src;
    avatarEl.addEventListener("error", () => {
      avatarEl.src = placeholder;
    });
    avatarEl.src = user.photoURL;
  }
}

function persist(fields) {
  setDoc(
    profileRef(),
    { ...fields, updatedAt: serverTimestamp() },
    { merge: true }
  ).catch((err) => console.error("Save profile failed:", err));
}

async function applyStoredPrefs() {
  let data = {};
  try {
    const snap = await getDoc(profileRef());
    if (snap.exists()) data = snap.data();
  } catch (err) {
    console.error("Load profile failed:", err);
  }

  // Theme — apply the stored choice if it differs from the device default.
  if (data.theme === "light" || data.theme === "dark") {
    savedTheme = data.theme;
    if (getTheme() !== data.theme) setTheme(data.theme);
  } else {
    savedTheme = getTheme();
  }

  // Preferred role — restore silently (no chat banner, no re-save).
  if (typeof data.preferredRole === "string") {
    savedRole = data.preferredRole;
    setRole(data.preferredRole, { announce: false });
  }
}

function init() {
  if (!user) return;
  renderIdentity();

  // Apply stored prefs first, then start listening — so the programmatic
  // applies above don't echo back as writes.
  applyStoredPrefs().then(() => {
    document.addEventListener("themechange", (e) => {
      const theme = e.detail?.theme ?? getTheme();
      if (theme !== savedTheme) {
        savedTheme = theme;
        persist({ theme });
      }
    });

    document.addEventListener("role-changed", (e) => {
      const role = e.detail?.role;
      if (role && role !== savedRole) {
        savedRole = role;
        persist({ preferredRole: role });
      }
    });
  });
}

init();
