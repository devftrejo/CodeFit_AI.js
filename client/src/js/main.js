// OpenAI API & Express Server Logic:

const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

function addMessage(content, isUser = false) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(isUser ? "user-message" : "bot-message");
  messageElement.textContent = content;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageElement;
}

async function sendMessage() {
  const message = userInput.value.trim();
  const systemMessage =
    "You are a helpful coding assistant. Your name is 'Code Fit AI JS'. You will be provided with a piece of JavaScript code, and your task is to explain it in a concise way. Do not answer queries unrelated to code. Never break character.";
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
            botReply += data.content;
            botMessageElement.textContent = botReply;
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

sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

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
