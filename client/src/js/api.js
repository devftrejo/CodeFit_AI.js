// Thin wrapper around the streaming chat endpoint. Defaults to the
// same-origin /api/chat path, which:
//   - in dev, Vite proxies to the Functions emulator (see client/vite.config.js)
//   - in prod, Firebase Hosting rewrites to the chat Cloud Function
// Set VITE_API_URL in client/.env only to override (e.g. non-Firebase deploy).

import { getIdToken } from "./auth.js";

const API_URL = import.meta.env.VITE_API_URL || "/api/chat";

export async function streamChat({ message, role, onChunk }) {
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
    body: JSON.stringify({ message, role }),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6);
      if (dataStr === "[DONE]") return;
      const data = JSON.parse(dataStr);
      onChunk(data.content);
    }
  }
}
