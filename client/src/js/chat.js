import { marked } from "marked";
import DOMPurify from "dompurify";

import { streamChat } from "./api.js";
import { closeNavbar } from "./navbar.js";
import { db, auth } from "./firebase.js";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

// Chat content (AI replies, replayed history, the user's own input) is rendered
// as Markdown -> HTML and injected via innerHTML. marked does NOT sanitize, so
// run its output through DOMPurify first; otherwise crafted/prompt-injected
// content could inject scripts or event handlers (XSS) into the page.
function renderMarkdown(content) {
  return DOMPurify.sanitize(marked.parse(content));
}

// systemMessages now lives on the server (functions/prompts.js); the client
// only tracks which role key to send.
let currentRole = "codeExplainer";

// Roles whose help is about the user's own code — when one of these is active,
// the current sandbox (editor) contents are attached to the request as context.
const CODE_ROLES = new Set(["codeExplainer", "debugger", "optimizationExpert"]);

// The conversation the current chat belongs to. Every conversation is anchored
// to a curriculum topic (see curriculum.js): there's no free-form chat outside
// the curriculum. `currentConversationId` is null until the first message of a
// topic creates one server-side (the function returns the id, which we reuse so
// follow-ups thread into the same conversation). `activeTopic` is the
// { language, topic } the chat is scoped to — null means no topic picked yet,
// so the input is disabled and sending is blocked.
let currentConversationId = null;
let activeTopic = null;

const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const chatHeader = document.getElementById("chatHeader");
const chatTopicLabel = document.getElementById("chatTopic");
const clearHistoryButton = document.getElementById("clearHistory");

const NO_TOPIC_PLACEHOLDER =
  "Select a topic from the Curriculum menu to begin…";
const TOPIC_PLACEHOLDER = "Type your message…";

// Disable the chat input until a curriculum topic is active, so a learner can't
// start a conversation that isn't anchored to something they're learning.
function setInputEnabled(enabled) {
  userInput.disabled = !enabled;
  sendButton.disabled = !enabled;
  userInput.placeholder = enabled ? TOPIC_PLACEHOLDER : NO_TOPIC_PLACEHOLDER;
  // voice.js mirrors this to gate the mic button (voice is only available once a
  // topic is active, same as the text input).
  document.dispatchEvent(
    new CustomEvent("chat-input-enabled", { detail: { enabled } })
  );
}

// Reflect the current topic in the chat header. The header stays hidden until a
// topic is open; the clear-history button is enabled only once the topic has a
// persisted conversation (currentConversationId) to delete.
function updateChatHeader() {
  if (activeTopic) {
    chatTopicLabel.textContent = `${activeTopic.language} · ${activeTopic.topic}`;
    chatHeader.hidden = false;
  } else {
    chatHeader.hidden = true;
  }
  clearHistoryButton.disabled = !currentConversationId;
}

function addMessage(content, isUser = false) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(isUser ? "user-message" : "bot-message");
  messageElement.innerHTML = renderMarkdown(content);

  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageElement;
}

// Reveal a bot message progressively, the way live AI replies stream in, so
// hard-coded bot text (the intro, role announcements) doesn't pop in all at
// once. Re-renders sanitized Markdown each step — identical to the live path —
// and resolves when fully shown. Cancels itself if the bubble gets removed
// (e.g. a topic is opened, clearing the chat).
function streamBotMessage(content, { wordDelay = 30 } = {}) {
  const element = addMessage("", false);

  // Honor reduced-motion preferences: skip the animation, show it immediately.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.innerHTML = renderMarkdown(content);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return Promise.resolve();
  }

  // Words with their trailing whitespace, so spacing and newlines (and thus the
  // Markdown structure) survive as the text builds up.
  const tokens = content.match(/\S+\s*/g) ?? [];
  let shown = "";
  let index = 0;

  return new Promise((resolve) => {
    const step = () => {
      if (!element.isConnected || index >= tokens.length) {
        resolve();
        return;
      }
      shown += tokens[index];
      index += 1;
      element.innerHTML = renderMarkdown(shown);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      setTimeout(step, wordDelay);
    };
    step();
  });
}

// Friendly copy for a 429 from the chat endpoint, using the server's retry hint
// (seconds) when it's available.
function rateLimitMessage(retryAfterSeconds) {
  let wait = "a moment";
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    if (retryAfterSeconds < 60) {
      wait = `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`;
    } else {
      const minutes = Math.ceil(retryAfterSeconds / 60);
      wait = `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
  }
  return `**Slow down a moment.** You're sending messages too quickly — please wait ${wait} and try again.`;
}

// Returns the assistant's full reply text on success, or "" if the turn was
// skipped or errored — voice.js uses the return value to decide whether to speak
// the reply back.
export async function sendMessage(customMessage = null) {
  // No topic, no chat — the input is disabled in this state, but guard anyway.
  if (!activeTopic) return "";

  const message = customMessage || userInput.value.trim();
  if (!message) return "";

  addMessage(message, true);
  userInput.value = "";

  const botMessageElement = addMessage("", false);
  let botReply = "";

  // For code-focused roles, attach the current sandbox so the AI can work on
  // what the learner actually wrote (only when a pane is non-empty). The editor
  // is imported lazily so it (and the CodeMirror bundle) stays out of the mobile
  // build — code roles aren't reachable on mobile, so this never runs there.
  let code = null;
  if (CODE_ROLES.has(currentRole)) {
    const { getEditorContents } = await import("./editor.js");
    const contents = getEditorContents();
    if (contents.html.trim() || contents.css.trim() || contents.js.trim()) {
      code = contents;
    }
  }

  try {
    const result = await streamChat({
      message,
      role: currentRole,
      conversationId: currentConversationId,
      language: activeTopic.language,
      topic: activeTopic.topic,
      code,
      onChunk: (chunk) => {
        botReply += chunk;
        botMessageElement.innerHTML = renderMarkdown(botReply);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
    });
    if (result?.conversationId) {
      currentConversationId = result.conversationId;
      // The first message of a fresh topic creates its conversation — now there
      // is history to clear, so enable the control.
      updateChatHeader();
    }
    return botReply;
  } catch (error) {
    console.error("Error:", error);
    const text =
      error?.code === "rate_limited"
        ? rateLimitMessage(error.retryAfterSeconds)
        : "An error occurred while processing your request.";
    // If nothing streamed yet, replace the empty bot bubble with the notice;
    // otherwise keep the partial reply and add the notice as its own message.
    if (botReply) {
      addMessage(text, false);
    } else {
      botMessageElement.innerHTML = renderMarkdown(text);
    }
    return "";
  }
}

const ROLE_LABELS = {
  codeExplainer: {
    title: "Code Explainer",
    prompt:
      "I'll look at your sandbox code — ask me to explain it, or paste a snippet.",
  },
  debugger: {
    title: "Debugger",
    prompt:
      "I'll look at your sandbox code — tell me the bug, or paste a snippet to debug.",
  },
  optimizationExpert: {
    title: "Optimization Expert",
    prompt:
      "I'll look at your sandbox code — ask me to optimize it, or paste a snippet.",
  },
  curriculumExplainer: {
    title: "Curriculum Explainer",
    prompt: "Select a topic from the Curriculum menu to learn about it.",
  },
};

function updateSelectedRole(role, { announce = true } = {}) {
  currentRole = role;

  document.querySelectorAll(".role-option").forEach((el) => {
    el.classList.toggle("active", el.dataset.role === role);
  });

  if (announce) {
    if (ROLE_LABELS[role]) {
      // Stream the announcement like a real reply, then the prompt after it.
      streamBotMessage(`AI role changed to: ${ROLE_LABELS[role].title}`).then(
        () => streamBotMessage(ROLE_LABELS[role].prompt)
      );
    }
    // `announce` marks an explicit AI Roles menu pick (vs a silent change from
    // curriculum selection or restoring the saved preference on load), so this
    // is the moment profile.js remembers the role as the user's preferred one.
    document.dispatchEvent(
      new CustomEvent("role-changed", { detail: { role } })
    );
  }
}

// Set the active role programmatically (e.g. restoring a saved preferredRole on
// load). Pass { announce: false } to avoid the chat banner and the
// "role-changed" event, so restoring a preference doesn't re-save it.
export function setRole(role, options = {}) {
  updateSelectedRole(role, options);
}

const INTRO_MESSAGE = `
**Hello! I'm Code Fit AI, your personal coding assistant.**

To keep you on track, every chat is anchored to a lesson. Pick a topic from the
**Curriculum** menu to begin — I'll explain it, then answer your follow-up
questions right here in that topic's thread.

Already covered a topic? Re-select it from the menu to pick the conversation
back up where you left off.`;

function clearChat() {
  chatMessages.innerHTML = "";
}

// Open a curriculum topic in the chat pane. Called by curriculum.js after it
// resolves whether the topic already has a saved conversation:
//   - With `conversationId` + `messages`: resume that topic's thread (replay).
//   - Without: a fresh topic — clear the pane and kick it off with the
//     "Explain…" prompt, which creates the conversation server-side.
// Either way the chat becomes scoped to { language, topic } and the input is
// enabled. The role is set to curriculumExplainer silently (no banner, and no
// "role-changed" event, so it doesn't overwrite the user's preferredRole).
export function openTopic({ language, topic, conversationId, messages }) {
  updateSelectedRole("curriculumExplainer", { announce: false });
  activeTopic = { language, topic };
  setInputEnabled(true);

  if (conversationId) {
    currentConversationId = conversationId;
    clearChat();
    for (const m of messages ?? []) {
      addMessage(m.content, m.role === "user");
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } else {
    currentConversationId = null;
    clearChat();
    sendMessage(`Explain the ${topic} topic in ${language}.`);
  }

  updateChatHeader();
}

// Delete a conversation and all of its messages. The Firestore rules let the
// owner delete both; the messages must go too so no orphaned subcollection is
// left behind. Batched so the whole topic clears in one atomic write.
async function deleteConversation(conversationId) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const conversationRef = doc(
    db,
    "users",
    uid,
    "conversations",
    conversationId
  );
  const messagesSnap = await getDocs(collection(conversationRef, "messages"));
  const batch = writeBatch(db);
  messagesSnap.forEach((messageDoc) => batch.delete(messageDoc.ref));
  batch.delete(conversationRef);
  await batch.commit();
}

// Clear the active topic's saved history: delete its conversation, then restart
// the topic fresh — same as opening a never-seen topic (re-runs the "Explain…"
// kickoff). No-ops unless a topic with a persisted conversation is open.
async function clearTopicHistory() {
  if (!activeTopic || !currentConversationId) return;

  const { language, topic } = activeTopic;
  if (
    !window.confirm(
      `Clear your saved history for "${topic}"? This can't be undone.`
    )
  ) {
    return;
  }

  clearHistoryButton.disabled = true;
  try {
    await deleteConversation(currentConversationId);
  } catch (error) {
    console.error("Clearing topic history failed:", error);
    addMessage("**Couldn't clear this topic's history.** Please try again.");
    clearHistoryButton.disabled = false;
    return;
  }

  // Restart the topic from scratch, exactly like a first-time selection.
  openTopic({ language, topic });
}

function aiIntroduction() {
  setTimeout(() => {
    // If a topic was opened during the delay, the intro is no longer relevant.
    if (activeTopic) return;
    streamBotMessage(INTRO_MESSAGE);
  }, 1000);
}

sendButton.addEventListener("click", () => sendMessage());
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

clearHistoryButton.addEventListener("click", clearTopicHistory);

document.querySelectorAll(".role-option").forEach((option) => {
  option.addEventListener("click", (e) => {
    e.preventDefault();
    updateSelectedRole(e.currentTarget.dataset.role);
    closeNavbar();
  });
});

// Start in the no-topic state: input disabled, intro nudging toward Curriculum.
setInputEnabled(false);
aiIntroduction();
