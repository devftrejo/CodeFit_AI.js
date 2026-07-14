// Shared setup + guards for the Cloud Functions. The chat and voice endpoints
// all sit behind the same Firebase Auth check and per-user rate limit, so that
// security/cost logic lives here once instead of being copy-pasted per handler.
//
// The Admin SDK is initialized exactly once at module load (importing this file
// from every function guarantees a single init). In the emulator it auto-targets
// the Auth + Firestore emulators via the env vars the suite injects; in prod it
// uses the Functions service-account credentials.

import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { OpenAI } from "openai";

initializeApp();

// adminAuth is used only by authenticate() below, so it stays module-local; db
// and FieldValue are re-exported for the handlers' Firestore work.
const adminAuth = getAuth();
export const db = getFirestore();
export { FieldValue };

// OPENAI_API_KEY is held in Secret Manager
// (`firebase functions:secrets:set OPENAI_API_KEY`). In the emulator it reads
// from functions/.secret.local instead. Never put it in plain env vars.
export const openaiKey = defineSecret("OPENAI_API_KEY");

// One OpenAI client per request. Created per-call rather than at module load
// because openaiKey.value() is only readable once the secret is bound to the
// running function (declared via `secrets: [openaiKey]` on each handler).
export function getOpenAI() {
  return new OpenAI({ apiKey: openaiKey.value() });
}

// Origins allowed to call the functions directly. The prod client bypasses the
// Hosting rewrite (it buffers SSE), so it hits the functions cross-origin and
// needs CORS; the voice endpoints are reached the same way.
export const CORS_ORIGINS = [
  "https://codefit-ai-js.web.app",
  "https://codefit-ai-js.firebaseapp.com",
  "http://localhost:8080",
];

// Per-user rate limit shared across every OpenAI-backed endpoint — bounds cost
// and abuse from a signed-in account. Fixed windows tracked in Firestore
// (rateLimits/{uid}) so the cap is global across all function instances; an
// in-memory counter would only limit per-instance. A voice turn spends a few
// calls (transcribe + chat + speak), all counted against the same windows.
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_PER_DAY = 300;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Require POST + a valid App Check token + a valid Firebase ID token — the
// shared prologue for every handler. Returns the uid to proceed, or null after
// writing the 405/401 onto `res` (the caller should `return`). App Check
// (attests the request is from our genuine app) is verified before auth
// (attests the user), so a request from an unrecognized app is rejected before
// any token work. Endpoint-specific validation and the rate limit run after
// this, so each handler controls their ordering — chat rate-limits only after
// validating, so malformed requests don't consume quota.
export async function requirePostAuth(req, res) {
  if (req.method !== "POST") {
    res.set("Allow", "POST").status(405).json({ error: "Method not allowed" });
    return null;
  }
  if (!(await verifyAppCheck(req, res))) return null;
  return authenticate(req, res);
}

// Verify the App Check token on a request (the X-Firebase-AppCheck header the
// client attaches). Returns true to proceed, or false after writing a 401 onto
// `res`. Skipped under the emulator: dev runs locally with no public exposure
// and the client doesn't mint App Check tokens there. In prod a missing or
// invalid token is rejected — this is the app-attestation guard on the public
// functions.
async function verifyAppCheck(req, res) {
  if (process.env.FUNCTIONS_EMULATOR === "true") return true;

  const token = req.get("X-Firebase-AppCheck");
  if (!token) {
    res.status(401).json({ error: "Missing App Check token" });
    return false;
  }
  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch (error) {
    console.warn("App Check verification failed:", error.code || error.message);
    res.status(401).json({ error: "Invalid App Check token" });
    return false;
  }
}

// Verify the Firebase ID token on a request. Returns the uid on success, or
// null after writing the appropriate 401 onto `res` — internal to this module
// (handlers go through requirePostAuth).
async function authenticate(req, res) {
  const authHeader = req.get("Authorization") || "";
  const tokenMatch = authHeader.match(/^Bearer (.+)$/);
  if (!tokenMatch) {
    res
      .status(401)
      .json({ error: "Missing or malformed Authorization header" });
    return null;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(tokenMatch[1]);
    return decodedToken.uid;
  } catch (error) {
    console.warn("ID token verification failed:", error.code || error.message);
    res.status(401).json({ error: "Invalid or expired auth token" });
    return null;
  }
}

// Fixed-window per-user rate limit keyed by uid. Returns
// { allowed, retryAfterSeconds }. Stored under rateLimits/{uid}, which no
// Firestore rule grants the client (default-deny), so only this Admin SDK code
// can read/write it. Fails OPEN on a Firestore error — the limit is a cost
// guard, not a security boundary, so a transient datastore issue shouldn't take
// the endpoints down.
export async function checkRateLimit(uid) {
  const ref = db.collection("rateLimits").doc(uid);
  try {
    return await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const now = Date.now();
      const data = snapshot.exists ? snapshot.data() : {};
      let minuteStart = data.minuteStart ?? 0;
      let minuteCount = data.minuteCount ?? 0;
      let dayStart = data.dayStart ?? 0;
      let dayCount = data.dayCount ?? 0;

      // Reset a window once it has elapsed.
      if (now - minuteStart >= MINUTE_MS) {
        minuteStart = now;
        minuteCount = 0;
      }
      if (now - dayStart >= DAY_MS) {
        dayStart = now;
        dayCount = 0;
      }

      if (minuteCount >= RATE_LIMIT_PER_MINUTE) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((minuteStart + MINUTE_MS - now) / 1000),
        };
      }
      if (dayCount >= RATE_LIMIT_PER_DAY) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((dayStart + DAY_MS - now) / 1000),
        };
      }

      tx.set(ref, {
        minuteStart,
        minuteCount: minuteCount + 1,
        dayStart,
        dayCount: dayCount + 1,
      });
      return { allowed: true };
    });
  } catch (error) {
    console.error("Rate-limit check failed (failing open):", error);
    return { allowed: true };
  }
}

// Write a 429 with the retry hint both as the standard Retry-After header (for
// proxies / non-browser clients) and in the body — the header isn't CORS-exposed
// on the cross-origin prod calls, so the browser client reads it from the body.
export function sendRateLimited(res, retryAfterSeconds) {
  res.set("Retry-After", String(retryAfterSeconds)).status(429).json({
    error: "Rate limit exceeded. Please slow down and try again shortly.",
    retryAfterSeconds,
  });
}
