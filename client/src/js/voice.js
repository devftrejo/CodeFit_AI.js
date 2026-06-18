// Turn-based voice (app-only). A mic button lets the learner speak instead of
// type: record a clip -> transcribe it (server STT) -> send it through the normal
// chat flow -> speak the reply back (server TTS). Typed messages stay text-only;
// only voice-initiated turns get a spoken reply, so voice-in pairs with voice-out
// and text-in with text-out.
//
// gpt-5.4-mini is text-only, so this is purely an I/O layer around the existing
// pipeline — persistence, topic scoping, and the rate limit are unchanged (see
// functions/voice.js). Loaded after auth resolves (see entries/app.js).

import { transcribeAudio, synthesizeSpeech } from "./api.js";
import { sendMessage } from "./chat.js";

const micButton = document.getElementById("micButton");
const userInput = document.getElementById("userInput");
const voiceDisclaimer = document.getElementById("voiceDisclaimer");
const chatMessages = document.getElementById("chatMessages");

// `recorder` is set only while capturing; `chunks` collects the audio data
// events. `busy` covers the whole turn (transcribe -> chat -> speak) so the mic
// can't be re-triggered mid-flight.
let recorder = null;
let chunks = [];
let busy = false;

// Spoken-reply playback uses Web Audio. Browsers block audio that isn't tied to
// a user gesture, and our reply plays seconds after the mic tap (post STT + chat
// + TTS), so HTMLAudioElement autoplay is unreliable — especially on mobile.
// Instead we resume a shared AudioContext *during* the mic tap (a gesture), which
// unlocks it for the rest of the turn; a decoded buffer then plays without
// restriction. `currentSource` is the in-flight reply so a new turn can cut it
// off mid-sentence.
let audioCtx = null;
let currentSource = null;

// MediaRecorder needs a container the browser can produce; they differ (Chrome
// records webm, Safari mp4). Pick the first supported candidate.
function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

// Reflect the current phase on the button. states: idle | recording | busy |
// unavailable. "unavailable" is the no-topic state (mic disabled like the input).
function setMicState(state) {
  micButton.classList.toggle("recording", state === "recording");
  micButton.classList.toggle("busy", state === "busy");
  micButton.disabled = state === "busy" || state === "unavailable";
  const titles = {
    idle: "Record a voice message",
    recording: "Stop recording",
    busy: "Working…",
    unavailable: "Pick a topic to use voice",
  };
  micButton.title = titles[state] ?? "";
  micButton.setAttribute("aria-label", micButton.title);
}

// The mic returns to idle/unavailable depending on whether a topic is active —
// the chat input's disabled flag is the single source of truth for that.
function restMicState() {
  setMicState(userInput.disabled ? "unavailable" : "idle");
}

function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  return audioCtx;
}

// Called from the mic tap (a user gesture) to unlock audio output for the turn's
// eventual spoken reply. Resuming here, inside the gesture, is what lets the
// later (gesture-less) playback through.
function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function stopPlayback() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // Already stopped/ended — nothing to do.
    }
    currentSource = null;
  }
}

// Speak a reply: decode the MP3 and play it through the gesture-unlocked
// AudioContext. If anything fails (no Web Audio, decode error, or the context
// couldn't be unlocked), fall back to a tap-to-play control so the learner can
// always hear the reply with a fresh gesture instead of it silently not playing.
async function playReply(blob) {
  stopPlayback();
  const ctx = getAudioContext();
  if (!ctx) {
    offerTapToPlay(blob);
    return;
  }

  try {
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      if (currentSource === source) currentSource = null;
    };
    currentSource = source;
    source.start();
  } catch (error) {
    console.warn(
      "Auto playback unavailable; offering tap-to-play:",
      error?.name || error
    );
    offerTapToPlay(blob);
  }
}

// Fallback when auto playback is blocked: a one-tap control appended to the chat.
// The tap is a fresh user gesture, so an <audio> element plays without restriction.
function offerTapToPlay(blob) {
  if (!chatMessages) return;
  const url = URL.createObjectURL(blob);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "voice-play-reply";
  button.innerHTML =
    '<i class="fa-solid fa-volume-high"></i> Tap to hear reply';
  button.addEventListener("click", () => {
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), {
      once: true,
    });
    audio.play().catch((error) => {
      console.error("Manual playback failed:", error);
    });
    button.remove();
  });
  chatMessages.appendChild(button);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Run one voice turn from a recorded clip: STT -> chat -> spoken reply.
async function handleClip(blob) {
  busy = true;
  setMicState("busy");
  try {
    const text = await transcribeAudio(blob);
    if (!text.trim()) return; // nothing intelligible — quietly reset

    // Route the transcript through the normal chat flow (adds the user bubble,
    // streams + persists the reply). It returns the reply text on success.
    const reply = await sendMessage(text);
    if (reply.trim()) {
      // Synthesis/playback is isolated so a failure here (e.g. a rate-limited
      // TTS call, or blocked autoplay) is reported distinctly and doesn't read
      // as a transcription/chat failure — the text reply is already shown.
      try {
        await playReply(await synthesizeSpeech(reply));
      } catch (error) {
        console.error("Speech synthesis failed:", error);
      }
    }
  } catch (error) {
    console.error("Voice turn failed (transcription or chat):", error);
  } finally {
    busy = false;
    restMicState();
  }
}

async function startRecording() {
  stopPlayback();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    console.error("Microphone unavailable or permission denied:", error);
    return;
  }

  const mimeType = pickMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.addEventListener("stop", () => {
    // Release the mic so the browser's recording indicator clears.
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
    recorder = null;
    if (blob.size) {
      handleClip(blob);
    } else {
      restMicState();
    }
  });

  recorder.start();
  setMicState("recording");
}

function stopRecording() {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
}

function onMicClick() {
  if (busy) return;
  // This click is a user gesture — unlock audio output now so the spoken reply
  // (which plays later, after the async STT/chat/TTS round-trip) is allowed.
  unlockAudio();
  if (recorder) {
    stopRecording();
  } else {
    startRecording();
  }
}

function init() {
  if (!micButton) return;

  // Feature-detect: without MediaRecorder + getUserMedia, hide the mic entirely
  // rather than offer a control that can't work (e.g. older/unsupported browsers).
  if (
    typeof MediaRecorder === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    micButton.hidden = true;
    return;
  }

  micButton.addEventListener("click", onMicClick);
  restMicState();

  // Voice is available, so spoken replies can play — reveal the AI-voice
  // disclosure that OpenAI's usage policy requires.
  if (voiceDisclaimer) voiceDisclaimer.hidden = false;

  // Mirror the chat input's enabled state (gated on an active topic). Ignore
  // changes mid-turn so a topic switch can't yank the button out from under a
  // recording or in-flight request.
  document.addEventListener("chat-input-enabled", () => {
    if (busy || recorder) return;
    restMicState();
  });
}

init();
