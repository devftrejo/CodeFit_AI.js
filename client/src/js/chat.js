import { marked } from "marked";

import { streamChat } from "./api.js";
import { closeNavbar } from "./navbar.js";

// systemMessages now lives on the server (functions/prompts.js); the client
// only tracks which role key to send.
let currentRole = "codeExplainer";

// The conversation the current chat belongs to. Null until the first message
// creates one server-side; the function returns the id, which we reuse for
// subsequent messages so they thread into the same conversation. Phase 5 will
// let the user switch/clear this from a conversations menu.
let currentConversationId = null;

const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

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

  if (announce && ROLE_LABELS[role]) {
    addMessage(`AI role changed to: ${ROLE_LABELS[role].title}`, false);
    addMessage(ROLE_LABELS[role].prompt, false);
  }
}

function handleCurriculumTopicSelection(language, topic) {
  // Skip the announcement — we're about to send the actual prompt, so the
  // generic "select a topic from the menu" message would be contradictory.
  updateSelectedRole("curriculumExplainer", { announce: false });
  sendMessage(`Explain the ${topic} topic in ${language}.`);
}

function aiIntroduction() {
  setTimeout(() => {
    const introMessage = `
**Hello! I'm Code Fit AI, your personal coding assistant.**

I can help you with various programming tasks, including:
* Explaining code
* Debugging
* Optimization
* Teaching web development concepts

To get started, you can:
1. Choose a role for me from the AI Roles menu.
2. Select a topic from the Curriculum menu to learn about specific concepts.
3. Or simply type your coding question in the chat box below.

*How can I assist you today?*`;

    addMessage(introMessage, false);
  }, 1000);
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

document.querySelectorAll(".curriculum-topic").forEach((topicElement) => {
  topicElement.addEventListener("click", (e) => {
    e.preventDefault();
    const language = e.currentTarget.dataset.language;
    const topic = e.currentTarget.dataset.topic;
    handleCurriculumTopicSelection(language, topic);
    closeNavbar();
  });
});

aiIntroduction();
