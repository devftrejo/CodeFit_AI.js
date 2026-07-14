// Thin wrapper around the streaming chat endpoint. The URL is VITE_API_URL
// when set, otherwise the relative /api/chat:
//   - dev: unset -> /api/chat, which the Vite proxy forwards to the Functions
//     emulator (see client/vite.config.js).
//   - prod: VITE_API_URL (client/.env.production) points at the Cloud Function
//     directly, because Firebase Hosting buffers SSE from its /api/chat rewrite.

import { getIdToken } from "./auth.js";
import { getAppCheckToken } from "./firebase.js";

const API_URL = import.meta.env.VITE_API_URL || "/api/chat";

// The voice endpoints live next to the chat function. In prod VITE_API_URL is
// the direct Cloud Function URL ending in /chat; in dev it's the /api/chat proxy
// path. Swapping the trailing /chat yields the sibling transcribe/speak URLs in
// both environments (the Vite proxy forwards /api/transcribe and /api/speak too).
const TRANSCRIBE_URL = API_URL.replace(/\/chat$/, "/transcribe");
const SPEAK_URL = API_URL.replace(/\/chat$/, "/speak");

// Map a failed response to an Error. A 429 becomes a structured rate-limit error
// (code "rate_limited" + retryAfterSeconds from the body — the Retry-After header
// isn't CORS-exposed on the cross-origin prod calls) that chat.js renders as a
// friendly notice; anything else is a generic error tagged with `label`.
async function toApiError(response, label) {
  if (response.status === 429) {
    let retryAfterSeconds = null;
    try {
      const body = await response.json();
      retryAfterSeconds = body?.retryAfterSeconds ?? null;
    } catch {
      // Body wasn't JSON; leave the hint null and use generic copy.
    }
    const error = new Error("rate_limited");
    error.code = "rate_limited";
    error.retryAfterSeconds = retryAfterSeconds;
    return error;
  }
  return new Error(`${label} request failed: ${response.status}`);
}

// Fetch a fresh ID token or throw — every endpoint requires auth.
async function authHeader() {
  const token = await getIdToken();
  if (!token) {
    throw new Error("Not signed in.");
  }
  return `Bearer ${token}`;
}

// Build the auth + App Check headers shared by every request. The App Check
// header is omitted in dev (no token) and included in prod, where the functions
// require it. Spread into each fetch's headers.
async function commonHeaders() {
  const headers = { Authorization: await authHeader() };
  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }
  return headers;
}

// Resolves to { conversationId } once the stream completes. Pass the existing
// conversationId to continue a conversation, or null/undefined to start a new
// one (the function creates it and returns the new id in the final SSE event).
// `language`/`topic` identify the curriculum topic a new conversation belongs
// to — required when conversationId is null (every chat is topic-scoped).
// `code` is the learner's current sandbox ({ html, css, js }), sent for
// code-focused roles so the AI can work on it; null/omitted otherwise.
export async function streamChat({
  message,
  role,
  conversationId,
  language,
  topic,
  code,
  onChunk,
}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await commonHeaders()),
    },
    body: JSON.stringify({
      message,
      role,
      conversationId: conversationId ?? null,
      language: language ?? null,
      topic: topic ?? null,
      code: code ?? null,
    }),
  });

  if (!response.ok) {
    throw await toApiError(response, "Chat");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let resolvedConversationId = conversationId ?? null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6);
      if (dataStr === "[DONE]")
        return { conversationId: resolvedConversationId };
      const data = JSON.parse(dataStr);
      if (typeof data.content === "string") {
        onChunk(data.content);
      } else if (data.conversationId) {
        // Final metadata event from the function.
        resolvedConversationId = data.conversationId;
      } else if (data.error) {
        throw new Error(data.error);
      }
    }
  }

  return { conversationId: resolvedConversationId };
}

// POST a recorded audio clip to the transcription (STT) endpoint and return the
// recognized text. The clip is sent as the raw request body with the recorder's
// MIME type so the server can hand it straight to OpenAI.
export async function transcribeAudio(blob) {
  const response = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "audio/webm",
      ...(await commonHeaders()),
    },
    body: blob,
  });

  if (!response.ok) {
    throw await toApiError(response, "Transcription");
  }

  const data = await response.json();
  return data.text ?? "";
}

// POST assistant text to the speech (TTS) endpoint and return an audio Blob the
// caller can play back.
export async function synthesizeSpeech(text) {
  const response = await fetch(SPEAK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await commonHeaders()),
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw await toApiError(response, "Speech");
  }

  return await response.blob();
}
