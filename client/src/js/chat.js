import { marked } from "marked";

import { streamChat } from "./api.js";
import { closeNavbar } from "./navbar.js";

// systemMessages now lives on the server (functions/prompts.js); the client
// only tracks which role key to send.
let currentRole = "codeExplainer";

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

const NO_TOPIC_PLACEHOLDER =
  "Select a topic from the Curriculum menu to begin…";
const TOPIC_PLACEHOLDER = "Type your message…";

// Disable the chat input until a curriculum topic is active, so a learner can't
// start a conversation that isn't anchored to something they're learning.
function setInputEnabled(enabled) {
  userInput.disabled = !enabled;
  sendButton.disabled = !enabled;
  userInput.placeholder = enabled ? TOPIC_PLACEHOLDER : NO_TOPIC_PLACEHOLDER;
}

function addMessage(content, isUser = false) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(isUser ? "user-message" : "bot-message");
  messageElement.innerHTML = marked.parse(content);

  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageElement;
}

async function sendMessage(customMessage = null) {
  // No topic, no chat — the input is disabled in this state, but guard anyway.
  if (!activeTopic) return;

  const message = customMessage || userInput.value.trim();
  if (!message) return;

  addMessage(message, true);
  userInput.value = "";

  const botMessageElement = addMessage("", false);
  let botReply = "";

  try {
    const result = await streamChat({
      message,
      role: currentRole,
      conversationId: currentConversationId,
      language: activeTopic.language,
      topic: activeTopic.topic,
      onChunk: (chunk) => {
        botReply += chunk;
        botMessageElement.innerHTML = marked.parse(botReply);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
    });
    if (result?.conversationId) {
      currentConversationId = result.conversationId;
    }
  } catch (error) {
    console.error("Error:", error);
    addMessage("An error occurred while processing your request.");
  }
}

const ROLE_LABELS = {
  codeExplainer: {
    title: "Code Explainer",
    prompt: "Copy and paste the code you want me to explain to you.",
  },
  debugger: {
    title: "Debugger",
    prompt: "Copy and paste the code you want me to help you debug.",
  },
  optimizationExpert: {
    title: "Optimization Expert",
    prompt: "Copy and paste the code you want me to help you optimize.",
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
      addMessage(`AI role changed to: ${ROLE_LABELS[role].title}`, false);
      addMessage(ROLE_LABELS[role].prompt, false);
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
}

function aiIntroduction() {
  setTimeout(() => addMessage(INTRO_MESSAGE, false), 1000);
}

sendButton.addEventListener("click", () => sendMessage());
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

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
