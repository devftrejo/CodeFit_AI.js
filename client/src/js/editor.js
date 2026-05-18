// CodeMirror 5 is loaded as a global from the CDN (see index.html); declared
// in eslint.config.js. Migrated to npm + CodeMirror 6 in PR 2.

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
      <script>${js}</script>
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
  } finally {
    console.log = oldLog;
  }

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
