// Single Firebase bootstrap for the client. Every other module that needs
// Auth (or, later, Firestore) imports from here so initializeApp() is called
// exactly once per page load.
//
// The web config is *not* a secret — Firebase security comes from Auth +
// Firestore rules, not from hiding these values. Safe to commit.

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyDOLg5HNvTRG7ljFo_DzFBtUHD5KLJG3i0",
  authDomain: "codefit-ai-js.firebaseapp.com",
  projectId: "codefit-ai-js",
  storageBucket: "codefit-ai-js.firebasestorage.app",
  messagingSenderId: "816242909585",
  appId: "1:816242909585:web:312946443f37e727593a30",
};

// reCAPTCHA v3 site key for Firebase App Check. Public like firebaseConfig above
// (the secret half lives in the Firebase Console) — safe to commit. Generated
// when you register the reCAPTCHA v3 provider under Project settings → App Check.
// ⚠️ Paste the real key before deploying, or prod requests will lack an App
// Check token and the functions will reject them.
const RECAPTCHA_SITE_KEY = "6Le3X1ItAAAAAFIj9CyqfAl__JpsyHjf8zR0sx1d";

const app = initializeApp(firebaseConfig);
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

// App Check attests that requests come from our genuine app, bounding abuse of
// the public Cloud Functions (and, once enforced in the console, Firestore).
// Enforced in prod only: dev runs against the emulators (local, no public
// exposure), so we skip reCAPTCHA there to keep local dev friction-free — the
// functions likewise skip App Check verification under the emulator. Once
// initialized, the Firebase SDK also attaches the token to Firestore calls
// automatically; for the direct fetch() to the functions we read it via
// getAppCheckToken() below and send it as the X-Firebase-AppCheck header.
let appCheck = null;
if (import.meta.env.PROD) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Return a current App Check token for the X-Firebase-AppCheck header, or null
// when App Check isn't initialized (dev) or a token can't be minted — the
// caller simply omits the header, and the functions only require it in prod.
export async function getAppCheckToken() {
  if (!appCheck) return null;
  try {
    const { token } = await getToken(appCheck);
    return token;
  } catch (error) {
    console.warn("App Check token fetch failed:", error);
    return null;
  }
}
