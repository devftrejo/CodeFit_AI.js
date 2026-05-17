// OpenAI API & Express Server Logic:

const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

// System messages object:

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

// Default role:

let currentRole = "codeExplainer";

function addMessage(content, isUser = false) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(isUser ? "user-message" : "bot-message");

  // Parse markdown and set inner HTML:

  messageElement.innerHTML = marked.parse(content);

  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageElement;
}

async function sendMessage(customMessage = null) {
  const message = customMessage || userInput.value.trim();
  const systemMessage = systemMessages[currentRole];

  if (message) {
    addMessage(message, true);
    userInput.value = "";

    const botMessageElement = addMessage("", false);

    try {
      const response = await fetch("http://localhost:3000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, systemMessage }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botReply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;
            const data = JSON.parse(dataStr);

            // Parse markdown and append to the bot message:

            botReply += data.content;
            botMessageElement.innerHTML = marked.parse(botReply);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      addMessage("An error occurred while processing your request.");
    }
  }
}

function updateSelectedRole(role) {
  currentRole = role;

  // Update UI to reflect the selected role:

  document.querySelectorAll(".role-option").forEach((el) => {
    el.classList.toggle("active", el.dataset.role === role);
  });

  // You can add more UI updates here, like changing a label or displaying the current role:

  if (role === "codeExplainer") {
    addMessage(`AI role changed to: Code Explainer`, false);
    addMessage(`Copy and paste the code you want me to explain to you.`, false);
  } else if (role === "debugger") {
    addMessage(`AI role changed to: Debugger`, false);
    addMessage(`Copy and paste the code you want me to help you debug.`, false);
  } else if (role === "optimizationExpert") {
    addMessage(`AI role changed to: Optimization Expert`, false);
    addMessage(
      `Copy and paste the code you want me to help you optimize.`,
      false
    );
  } else if (role === "curriculumExplainer") {
    addMessage(`AI role changed to: Curriculum Explainer`, false);
    addMessage(
      `Select a topic from the Curriculum menu to learn about it.`,
      false
    );
  }
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

// Event listeners:

sendButton.addEventListener("click", () => sendMessage());
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// Add event listeners for role selection:

document.querySelectorAll(".role-option").forEach((option) => {
  option.addEventListener("click", (e) => {
    e.preventDefault();
    updateSelectedRole(e.currentTarget.dataset.role);

    // Close the navbar after selection:

    closeNavbar();
  });
});

// Add event listeners for curriculum topic selection:

document.querySelectorAll(".curriculum-topic").forEach((topicElement) => {
  topicElement.addEventListener("click", (e) => {
    e.preventDefault();
    const language = e.currentTarget.dataset.language;
    const topic = e.currentTarget.dataset.topic;
    handleCurriculumTopicSelection(language, topic);
    closeNavbar();
  });
});

// Function to handle curriculum topic selection:

function handleCurriculumTopicSelection(language, topic) {
  currentRole = "curriculumExplainer";
  updateSelectedRole(currentRole);

  const message = `Explain the ${topic} topic in ${language}.`;
  sendMessage(message);
}

// Code Editor Logic:

const editorOptions = {
  lineNumbers: true,
  theme: "midnight",
  autoCloseBrackets: true,
  matchBrackets: true,
  foldGutter: true,
  gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
  styleActiveLine: true,
  lineWrapping: true,
  rulers: [{ color: "#445", column: 80, lineStyle: "dashed" }],
  extraKeys: {
    "Ctrl-Q": function (cm) {
      cm.foldCode(cm.getCursor());
    },
    "Ctrl-/": "toggleComment",
  },
};

const htmlEditor = CodeMirror.fromTextArea(
  document.getElementById("html-editor"),
  { ...editorOptions, mode: "htmlmixed" }
);
const cssEditor = CodeMirror.fromTextArea(
  document.getElementById("css-editor"),
  { ...editorOptions, mode: "css" }
);
const jsEditor = CodeMirror.fromTextArea(document.getElementById("js-editor"), {
  ...editorOptions,
  mode: "javascript",
});

// CodeMirror's hidden input textarea has no id/name by default — give it one
// so DevTools doesn't flag "form field should have an id or name attribute".
[
  ["html", htmlEditor],
  ["css", cssEditor],
  ["js", jsEditor],
].forEach(([key, editor]) => {
  editor.getInputField().setAttribute("name", `cm-input-${key}`);
});

htmlEditor.setValue(
  "<!DOCTYPE html>\n<html>\n<head>\n  <title>Live Preview</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>"
);
cssEditor.setValue(
  "body {\n  font-family: Arial, sans-serif;\n  background-color: #f0f0f0;\n}\n\nh1 {\n  color: #333;\n}"
);
jsEditor.setValue("console.log('Hello from JavaScript!');");

const themeSelect = document.getElementById("theme-select");
const runCodeButton = document.getElementById("run-code");
const clearConsoleButton = document.getElementById("clear-console");
const consoleElement = document.getElementById("console");

function updatePreview() {
  const html = htmlEditor.getValue();
  const css = cssEditor.getValue();
  const js = jsEditor.getValue();

  const previewFrame = document.getElementById("preview");
  const previewContent = `
      ${html}
      <style>${css}</style>
      <script>${js}<\/script>
  `;

  previewFrame.srcdoc = previewContent;
}

function runCode() {
  const js = jsEditor.getValue();
  const oldLog = console.log;
  const logs = [];

  console.log = function (...args) {
    logs.push(
      args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ")
    );
    oldLog.apply(console, args);
  };

  try {
    eval(js);
  } catch (error) {
    console.error(error);
  }

  console.log = oldLog;
  consoleElement.innerHTML += logs.join("\n") + "\n";
  consoleElement.scrollTop = consoleElement.scrollHeight;
}

function clearConsole() {
  consoleElement.innerHTML = "";
}

function changeTheme() {
  const theme = themeSelect.value;
  [htmlEditor, cssEditor, jsEditor].forEach((editor) => {
    editor.setOption("theme", theme);
    editor.refresh();
  });

  if (theme === "midnight") {
    document.body.classList.remove("elegant-theme");
    document.body.classList.add("midnight-theme");
  } else if (theme === "elegant") {
    document.body.classList.remove("midnight-theme");
    document.body.classList.add("elegant-theme");
  }
}

htmlEditor.on("change", updatePreview);
cssEditor.on("change", updatePreview);
runCodeButton.addEventListener("click", runCode);
clearConsoleButton.addEventListener("click", clearConsole);
themeSelect.addEventListener("change", changeTheme);

updatePreview();

// Off Canvas Navbar:

const navbar = document.getElementById("navbar");
const toggleBtn = document.getElementById("toggleBtn");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");
const submenuToggles = document.querySelectorAll(".submenu-toggle");
const darkModeToggle = document.getElementById("lightModeToggle");

function openNavbar() {
  navbar.classList.add("active");
  overlay.style.display = "block";
  toggleBtn.style.display = "none";
  closeBtn.style.display = "block";
}

function closeNavbar() {
  navbar.classList.remove("active");
  overlay.style.display = "none";
  toggleBtn.style.display = "block";
  closeBtn.style.display = "none";
}

toggleBtn.addEventListener("click", openNavbar);
closeBtn.addEventListener("click", closeNavbar);
overlay.addEventListener("click", closeNavbar);

submenuToggles.forEach((toggle) => {
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    const submenu = toggle.nextElementSibling;
    submenu.classList.toggle("active");
    const icon = toggle.querySelector(".fa-chevron-down, .fa-chevron-up");
    if (icon) {
      icon.classList.toggle("fa-chevron-down");
      icon.classList.toggle("fa-chevron-up");
    }
  });
});

darkModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  const icon = darkModeToggle.querySelector("i");
  if (document.body.classList.contains("light-mode")) {
    icon.classList.replace("fa-sun", "fa-moon");
    darkModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> Dark Mode';
  } else {
    icon.classList.replace("fa-moon", "fa-sun");
    darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i> Light Mode';
  }
});

// Initialize the AI introduction message:

document.addEventListener("DOMContentLoaded", (event) => {
  aiIntroduction();
});
