// Thin wrapper around the streaming chat endpoint. Replace API_URL with a
// VITE_API_URL env var in PR 2 once CDN libs are migrated off.

const API_URL = "http://localhost:3000/";

export async function streamChat({ message, systemMessage, onChunk }) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, systemMessage }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
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
