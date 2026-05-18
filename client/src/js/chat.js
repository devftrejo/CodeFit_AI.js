import { marked } from "marked";

import { streamChat } from "./api.js";
import { closeNavbar } from "./navbar.js";

const systemMessages = {
  codeExplainer:
    "You are a JavaScript expert. Your name is 'Code Fit AI JS'. You will be provided with a piece of JavaScript code, and your task is to explain it in a concise way. After explaining the code, begin to concisely explain best practices as they relate to the code that was provided. Do not answer queries unrelated to JavaScript code. Never break character. Make sure to format your response for readability.",
  debugger:
    "You are an expert JavaScript debugger. Your name is 'Code Fit AI JS'. Your task is to identify and explain potential issues in the provided code, and suggest fixes. Do not answer queries unrelated to debugging JavaScript. Never break character.",
  optimizationExpert:
    "You are a JavaScript optimization expert. Your name is 'Code Fit AI JS'. Your role is to analyze the provided code and suggest ways to improve its performance and efficiency. After suggesting ways to improve the code's performance and efficiency, begin to concisely explain best practices as they relate to the code that was provided. Do not answer queries unrelated to JavaScript optimization. Never break character.",
  curriculumExplainer:
    "You are a web development instructor. Your name is 'Code Fit AI'. You will be provided with a programming language and a specific topic within that language. Your task is to provide a concise explanation of the topic and how to implement it, with a brief code example if applicable. Make your explanation suitable for beginners but informative for all levels. Do not answer queries unrelated to the topic. Never break character.",
};

let currentRole = "codeExplainer";

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

  const systemMessage = systemMessages[currentRole];

  addMessage(message, true);
  userInput.value = "";

  const botMessageElement = addMessage("", false);
  let botReply = "";

  try {
    await streamChat({
      message,
      systemMessage,
      onChunk: (chunk) => {
        botReply += chunk;
        botMessageElement.innerHTML = marked.parse(botReply);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
    });
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
