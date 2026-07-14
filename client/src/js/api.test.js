import { describe, it, expect, vi, beforeEach } from "vitest";

// api.js pulls a token from auth.js and an App Check token from firebase.js
// (both import Firebase); stub them so the module loads without a real Firebase
// app. getAppCheckToken returns null here, mirroring dev (no App Check header).
vi.mock("./auth.js", () => ({ getIdToken: async () => "test-token" }));
vi.mock("./firebase.js", () => ({ getAppCheckToken: async () => null }));

const { streamChat } = await import("./api.js");

// Build a fake SSE Response whose body streams the given data: lines.
function sseResponse(lines) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return { ok: true, body };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("streamChat SSE parsing", () => {
  it("collects content chunks and resolves the conversationId from the final event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'data: {"content":"Hello"}\n\n',
          'data: {"content":" world"}\n\n',
          'data: {"conversationId":"conv-123","messageId":"m1"}\n\n',
          "data: [DONE]\n\n",
        ])
      )
    );

    const chunks = [];
    const result = await streamChat({
      message: "hi",
      role: "curriculumExplainer",
      language: "JS",
      topic: "loops",
      onChunk: (c) => chunks.push(c),
    });

    expect(chunks).toEqual(["Hello", " world"]);
    expect(result).toEqual({ conversationId: "conv-123" });
  });

  it("throws when the stream emits an error event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse(['data: {"error":"generation_failed"}\n\n'])
      )
    );

    await expect(
      streamChat({
        message: "hi",
        role: "curriculumExplainer",
        onChunk: () => {},
      })
    ).rejects.toThrow("generation_failed");
  });
});

describe("streamChat error mapping", () => {
  it("maps a 429 to a structured rate_limited error carrying retryAfterSeconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ retryAfterSeconds: 42 }),
      }))
    );

    await expect(
      streamChat({
        message: "hi",
        role: "curriculumExplainer",
        onChunk: () => {},
      })
    ).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 42 });
  });

  it("throws a generic labeled error for other non-ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );

    await expect(
      streamChat({
        message: "hi",
        role: "curriculumExplainer",
        onChunk: () => {},
      })
    ).rejects.toThrow("Chat request failed: 500");
  });
});
