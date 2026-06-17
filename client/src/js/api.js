// Thin wrapper around the streaming chat endpoint. The URL is VITE_API_URL
// when set, otherwise the relative /api/chat:
//   - dev: unset -> /api/chat, which the Vite proxy forwards to the Functions
//     emulator (see client/vite.config.js).
//   - prod: VITE_API_URL (client/.env.production) points at the Cloud Function
//     directly, because Firebase Hosting buffers SSE from its /api/chat rewrite.

import { getIdToken } from "./auth.js";

const API_URL = import.meta.env.VITE_API_URL || "/api/chat";

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
  const token = await getIdToken();
  if (!token) {
    throw new Error("Not signed in.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
    if (response.status === 429) {
      // Rate limited. The Retry-After header isn't CORS-exposed on the
      // cross-origin prod call, so read the hint from the JSON body instead.
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
      throw error;
    }
    throw new Error(`Chat request failed: ${response.status}`);
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
