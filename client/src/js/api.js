// Thin wrapper around the streaming chat endpoint. Defaults to the
// same-origin /api/chat path, which:
//   - in dev, Vite proxies to the Functions emulator (see client/vite.config.js)
//   - in prod, Firebase Hosting rewrites to the chat Cloud Function
// Set VITE_API_URL in client/.env only to override (e.g. non-Firebase deploy).

import { getIdToken } from "./auth.js";

const API_URL = import.meta.env.VITE_API_URL || "/api/chat";

// Resolves to { conversationId } once the stream completes. Pass the existing
// conversationId to continue a conversation, or null/undefined to start a new
// one (the function creates it and returns the new id in the final SSE event).
export async function streamChat({ message, role, conversationId, onChunk }) {
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
    }),
  });

  if (!response.ok) {
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
