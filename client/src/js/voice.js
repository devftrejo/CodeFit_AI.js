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

// `recorder` is set only while capturing; `chunks` collects the audio data
// events. `busy` covers the whole turn (transcribe -> chat -> speak) so the mic
// can't be re-triggered mid-flight.
let recorder = null;
let chunks = [];
let busy = false;

// Current playback, so a new turn (or a stop) can cut off a reply mid-sentence.
let currentAudio = null;

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

function stopPlayback() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

// Play an audio Blob, revoking its object URL when done so blobs don't leak.
function playAudio(blob) {
  stopPlayback();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  const cleanup = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });
  audio.play().catch(cleanup);
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
      playAudio(await synthesizeSpeech(reply));
    }
  } catch (error) {
    console.error("Voice turn failed:", error);
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
