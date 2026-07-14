import { describe, it, expect, beforeEach, vi } from "vitest";

// shared.js touches Firebase Admin + OpenAI at import time, so stub those
// modules out. `state` is the knob each test uses to control what the mocked
// Firestore transaction sees (snapshot), what App Check / token verification
// return, and to observe what got written.
const { state } = vi.hoisted(() => ({
  state: {
    snapshot: null,
    throwOnTx: false,
    lastSet: null,
    appCheckValid: true,
    tokenValid: true,
    tokenUid: "user-123",
  },
}));

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: async (token) => {
      if (!state.tokenValid) throw new Error("invalid token");
      return { uid: state.tokenUid, token };
    },
  }),
}));
vi.mock("firebase-admin/app-check", () => ({
  getAppCheck: () => ({
    verifyToken: async (token) => {
      if (!state.appCheckValid) throw new Error("invalid app check token");
      return { token };
    },
  }),
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {},
  getFirestore: () => ({
    collection: () => ({ doc: () => ({}) }),
    runTransaction: async (cb) => {
      if (state.throwOnTx) throw new Error("firestore down");
      const tx = {
        get: async () => state.snapshot,
        set: (_ref, data) => {
          state.lastSet = data;
        },
      };
      return cb(tx);
    },
  }),
}));
vi.mock("firebase-functions/params", () => ({
  defineSecret: () => ({ value: () => "test-key" }),
}));
vi.mock("openai", () => ({ OpenAI: class {} }));

const { checkRateLimit, requirePostAuth } = await import("./shared.js");

// Build a Firestore snapshot stub for the rateLimits/{uid} doc.
function snapshot(data) {
  return data
    ? { exists: true, data: () => data }
    : { exists: false, data: () => ({}) };
}

// Minimal Express-style req/res doubles. `get` is case-insensitive like Express;
// headers are keyed lowercase. res records the status/body/headers it was sent.
function mockReqRes({ method = "POST", headers = {} } = {}) {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
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
  };
  const req = {
    method,
    get: (name) => headers[name.toLowerCase()],
  };
  return { req, res };
}

beforeEach(() => {
  state.snapshot = null;
  state.throwOnTx = false;
  state.lastSet = null;
  state.appCheckValid = true;
  state.tokenValid = true;
  state.tokenUid = "user-123";
});

describe("checkRateLimit", () => {
  it("allows a first request and starts both counters at 1", async () => {
    state.snapshot = snapshot(null);
    const result = await checkRateLimit("u1");
    expect(result.allowed).toBe(true);
    expect(state.lastSet.minuteCount).toBe(1);
    expect(state.lastSet.dayCount).toBe(1);
  });

  it("blocks once the per-minute cap (20) is reached, with a retry hint", async () => {
    const now = Date.now();
    state.snapshot = snapshot({
      minuteStart: now,
      minuteCount: 20,
      dayStart: now,
      dayCount: 20,
    });
    const result = await checkRateLimit("u1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    // A blocked request must not increment the counter.
    expect(state.lastSet).toBe(null);
  });

  it("blocks once the per-day cap (300) is reached even if the minute is fine", async () => {
    const now = Date.now();
    state.snapshot = snapshot({
      minuteStart: now,
      minuteCount: 1,
      dayStart: now,
      dayCount: 300,
    });
    const result = await checkRateLimit("u1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the minute window once it has elapsed", async () => {
    const now = Date.now();
    state.snapshot = snapshot({
      minuteStart: now - 61 * 1000, // over a minute ago
      minuteCount: 20, // was maxed out
      dayStart: now,
      dayCount: 5,
    });
    const result = await checkRateLimit("u1");
    expect(result.allowed).toBe(true);
    // Counter restarted at 1 for the fresh window; day counter kept climbing.
    expect(state.lastSet.minuteCount).toBe(1);
    expect(state.lastSet.dayCount).toBe(6);
  });

  it("fails open when the Firestore transaction throws (cost guard, not a security boundary)", async () => {
    state.throwOnTx = true;
    const result = await checkRateLimit("u1");
    expect(result.allowed).toBe(true);
  });
});

// FUNCTIONS_EMULATOR is unset under vitest, so App Check is enforced here — i.e.
// these exercise the prod path (the emulator bypass is verified by its absence).
describe("requirePostAuth", () => {
  const validHeaders = {
    "x-firebase-appcheck": "app-check-token",
    authorization: "Bearer id-token",
  };

  it("rejects a non-POST request with 405", async () => {
    const { req, res } = mockReqRes({ method: "GET", headers: validHeaders });
    const uid = await requirePostAuth(req, res);
    expect(uid).toBe(null);
    expect(res.statusCode).toBe(405);
  });

  it("rejects a missing App Check token with 401", async () => {
    const { req, res } = mockReqRes({
      headers: { authorization: "Bearer id-token" },
    });
    const uid = await requirePostAuth(req, res);
    expect(uid).toBe(null);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/App Check/);
  });

  it("rejects an invalid App Check token with 401 before checking auth", async () => {
    state.appCheckValid = false;
    const { req, res } = mockReqRes({ headers: validHeaders });
    const uid = await requirePostAuth(req, res);
    expect(uid).toBe(null);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/App Check/);
  });

  it("rejects a missing/malformed Authorization header with 401", async () => {
    const { req, res } = mockReqRes({
      headers: { "x-firebase-appcheck": "app-check-token" },
    });
    const uid = await requirePostAuth(req, res);
    expect(uid).toBe(null);
    expect(res.statusCode).toBe(401);
  });

  it("rejects an invalid ID token with 401", async () => {
    state.tokenValid = false;
    const { req, res } = mockReqRes({ headers: validHeaders });
    const uid = await requirePostAuth(req, res);
    expect(uid).toBe(null);
    expect(res.statusCode).toBe(401);
  });

  it("returns the uid when App Check and the ID token are both valid", async () => {
    const { req, res } = mockReqRes({ headers: validHeaders });
    const uid = await requirePostAuth(req, res);
    expect(uid).toBe("user-123");
    expect(res.statusCode).toBe(null); // nothing written on the happy path
  });
});
