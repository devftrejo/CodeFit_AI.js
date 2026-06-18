// Voice endpoints: turn-based speech I/O layered on the existing text chat.
// `transcribe` (STT) turns a recorded clip into text that the client then sends
// through the normal chat flow; `speak` (TTS) turns an assistant reply into
// audio for playback. Both sit behind the same Firebase Auth check and per-user
// rate limit as chat (see shared.js), so voice can't bypass the cost guard.
//
// gpt-5.4-mini is text-only, so voice is a separate STT/TTS layer wrapped around
// the existing pipeline — the chat model, Firestore persistence, topic scoping,
// and rate limiting are all unchanged.

import { onRequest } from "firebase-functions/v2/https";
import { toFile } from "openai";

import {
  openaiKey,
  CORS_ORIGINS,
  getOpenAI,
  requirePostAuth,
  checkRateLimit,
  sendRateLimited,
} from "./shared.js";

// Audio model IDs — the request-based STT/TTS path (not Realtime). STT:
// gpt-4o-mini-transcribe is the fast/cheap GPT-4o transcriber (mirrors the "mini"
// chat choice; supports json output so result.text is populated); swap to
// gpt-4o-transcribe for higher accuracy. TTS: gpt-4o-mini-tts is OpenAI's newest,
// most reliable TTS and honors the `instructions` tone control below.
const STT_MODEL = "gpt-4o-mini-transcribe";
const TTS_MODEL = "gpt-4o-mini-tts";
// gpt-4o-mini-tts exposes the full voice set; marin/cedar are the recommended
// best-quality voices (alloy/the rest also work).
const TTS_VOICE = "marin";
// Tone guidance for gpt-4o-mini-tts, so the spoken reply stays on-brand for a
// friendly coding tutor.
const TTS_INSTRUCTIONS =
  "Speak clearly and warmly, like an encouraging coding tutor.";
const TTS_FORMAT = "mp3"; // returned container; matches the audio/mpeg below

// Bound request sizes so a bad/oversized payload can't run up cost. Turn-based
// utterances are small (a short clip is well under a megabyte); the cap is a
// guard, not an expected size.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_TTS_CHARS = 4000; // plenty for a chat reply; truncate beyond this

const VOICE_FN_OPTIONS = {
  secrets: [openaiKey],
  memory: "512MiB",
  timeoutSeconds: 120,
  cors: CORS_ORIGINS,
};

// Map the recorder's MIME type to a file extension OpenAI recognizes. The clip
// is sent as the raw request body; OpenAI sniffs the format from the filename +
// bytes, so the extension must match what the browser actually recorded.
function audioExtension(contentType = "") {
  const type = contentType.toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a")) return "mp4";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  return "webm";
}

// STT: the recorded clip is the raw POST body (Content-Type is the recorder's
// MIME type). Returns { text } for the client to send through the chat flow.
export const transcribe = onRequest(VOICE_FN_OPTIONS, async (req, res) => {
  const uid = await requirePostAuth(req, res);
  if (!uid) return;

  const audio = req.rawBody;
  if (!audio || !audio.length) {
    res.status(400).json({ error: "Audio body is required." });
    return;
  }
  if (audio.length > MAX_AUDIO_BYTES) {
    res.status(413).json({ error: "Audio clip is too large." });
    return;
  }

  const rate = await checkRateLimit(uid);
  if (!rate.allowed) {
    sendRateLimited(res, rate.retryAfterSeconds);
    return;
  }

  try {
    const openai = getOpenAI();
    const contentType = req.get("Content-Type") || "audio/webm";
    const file = await toFile(audio, `audio.${audioExtension(contentType)}`, {
      type: contentType,
    });
    const result = await openai.audio.transcriptions.create({
      file,
      model: STT_MODEL,
    });
    res.status(200).json({ text: result.text ?? "" });
  } catch (error) {
    console.error("Transcription failed:", error);
    res.status(500).json({ error: "Failed to transcribe audio." });
  }
});

// TTS: { text } in, audio/mpeg out. The client plays the returned clip.
export const speak = onRequest(VOICE_FN_OPTIONS, async (req, res) => {
  const uid = await requirePostAuth(req, res);
  if (!uid) return;

  const { text } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "`text` is required." });
    return;
  }

  const rate = await checkRateLimit(uid);
  if (!rate.allowed) {
    sendRateLimited(res, rate.retryAfterSeconds);
    return;
  }

  try {
    const openai = getOpenAI();
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text.slice(0, MAX_TTS_CHARS),
      instructions: TTS_INSTRUCTIONS,
      response_format: TTS_FORMAT,
    });
    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res
      .status(200)
      .set("Content-Type", "audio/mpeg")
      .set("Cache-Control", "no-store")
      .send(audioBuffer);
  } catch (error) {
    console.error("Speech synthesis failed:", error);
    res.status(500).json({ error: "Failed to synthesize speech." });
  }
});
