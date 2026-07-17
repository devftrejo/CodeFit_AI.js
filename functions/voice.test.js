import { describe, it, expect, beforeEach, vi } from "vitest";

// The shared auth + rate-limit guards are covered in shared.test.js, so here we
// stub them and focus on the voice-specific logic: MIME→extension mapping, the
// upload size cap, TTS text truncation, and each handler's own input validation.
// `state` lets each test steer the stubbed guards and observe the OpenAI calls.
const { state } = vi.hoisted(() => ({
  state: {
    uid: "user-123",
    rate: { allowed: true },
    transcription: { text: "hello there" },
    speechCreateArgs: null,
  },
}));

// onRequest(opts, handler) → return the raw handler so tests can call it directly.
vi.mock("firebase-functions/v2/https", () => ({
  onRequest: (_opts, handler) => handler,
}));
vi.mock("openai", () => ({
  toFile: async (data, name, opts) => ({ data, name, opts }),
}));
vi.mock("./shared.js", () => ({
  openaiKey: {},
  CORS_ORIGINS: [],
  requirePostAuth: async () => state.uid,
  checkRateLimit: async () => state.rate,
  sendRateLimited: (res, retryAfterSeconds) =>
    res.status(429).json({ retryAfterSeconds }),
  getOpenAI: () => ({
    audio: {
      transcriptions: { create: async () => state.transcription },
      speech: {
        create: async (args) => {
          state.speechCreateArgs = args;
          return { arrayBuffer: async () => new ArrayBuffer(4) };
        },
      },
    },
  }),
}));

const { transcribe, speak, audioExtension } = await import("./voice.js");

function mockRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    sent: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    send(payload) {
      this.sent = payload;
      return this;
    },
  };
}

beforeEach(() => {
  state.uid = "user-123";
  state.rate = { allowed: true };
  state.transcription = { text: "hello there" };
  state.speechCreateArgs = null;
});

describe("audioExtension", () => {
  it("maps recorder MIME types to extensions OpenAI recognizes", () => {
    expect(audioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtension("audio/ogg")).toBe("ogg");
    expect(audioExtension("audio/mp4")).toBe("mp4");
    expect(audioExtension("audio/x-m4a")).toBe("mp4");
    expect(audioExtension("audio/mpeg")).toBe("mp3");
    expect(audioExtension("audio/wav")).toBe("wav");
  });

  it("falls back to webm for missing/unknown types", () => {
    expect(audioExtension("")).toBe("webm");
    expect(audioExtension("application/octet-stream")).toBe("webm");
  });
});

describe("transcribe", () => {
  it("rejects an empty audio body with 400", async () => {
    const res = mockRes();
    await transcribe({ rawBody: Buffer.alloc(0), get: () => "audio/webm" }, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects an oversized clip with 413", async () => {
    const res = mockRes();
    const tooBig = Buffer.alloc(10 * 1024 * 1024 + 1);
    await transcribe({ rawBody: tooBig, get: () => "audio/webm" }, res);
    expect(res.statusCode).toBe(413);
  });

  it("returns the transcript text on success", async () => {
    const res = mockRes();
    await transcribe(
      { rawBody: Buffer.from("clip"), get: () => "audio/webm" },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ text: "hello there" });
  });
});

describe("speak", () => {
  it("rejects missing/blank text with 400", async () => {
    const res = mockRes();
    await speak({ body: { text: "   " } }, res);
    expect(res.statusCode).toBe(400);
  });

  it("truncates text to the max length and returns audio/mpeg", async () => {
    const res = mockRes();
    await speak({ body: { text: "a".repeat(5000) } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("audio/mpeg");
    // MAX_TTS_CHARS = 4000 — input is capped before hitting OpenAI.
    expect(state.speechCreateArgs.input).toHaveLength(4000);
  });
});
