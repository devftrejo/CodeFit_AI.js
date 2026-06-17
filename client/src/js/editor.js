import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { foldCode } from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

// One Compartment instance lets us reconfigure the theme on all three editors
// from a single source of truth (see changeTheme below).
const themeCompartment = new Compartment();

// "Elegant" — an explicit light editor theme. Previously this was "no theme",
// which left the editor background transparent so it inherited the page; in
// light mode the container repaints to a light gray (.light-mode .container)
// and CodeMirror's default token colors washed out against it. Giving Elegant
// its own white background + dark text (like oneDark does for "Midnight") keeps
// the editor readable regardless of the page's light/dark mode. The default
// syntax highlighting from basicSetup still applies on top of this.
const elegantTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#ffffff", color: "#1b1b3b" },
    ".cm-content": { caretColor: "#1b1b3b" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#1b1b3b" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "#d1e7ff" },
    ".cm-activeLine": { backgroundColor: "rgba(27, 27, 59, 0.05)" },
    ".cm-gutters": {
      backgroundColor: "#f5f5f5",
      color: "#6c6c6c",
      border: "none",
    },
    ".cm-activeLineGutter": { backgroundColor: "rgba(27, 27, 59, 0.08)" },
  },
  { dark: false }
);

const updatePreviewListener = EditorView.updateListener.of((update) => {
  if (update.docChanged) updatePreview();
});

function makeEditor({ parent, language, doc, watchForPreview = false }) {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        language,
        EditorView.lineWrapping,
        keymap.of([{ key: "Ctrl-q", run: foldCode }]),
        themeCompartment.of(oneDark),
        ...(watchForPreview ? [updatePreviewListener] : []),
      ],
    }),
    parent,
  });
}

const htmlEditor = makeEditor({
  parent: document.getElementById("html-editor"),
  language: html(),
  doc: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Live Preview</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>",
  watchForPreview: true,
});

const cssEditor = makeEditor({
  parent: document.getElementById("css-editor"),
  language: css(),
  doc: "body {\n  font-family: Arial, sans-serif;\n  background-color: #f0f0f0;\n}\n\nh1 {\n  color: #333;\n}",
  watchForPreview: true,
});

const jsEditor = makeEditor({
  parent: document.getElementById("js-editor"),
  language: javascript(),
  doc: "console.log('Hello from JavaScript!');",
});

const themeSelect = document.getElementById("theme-select");
const runCodeButton = document.getElementById("run-code");
const clearConsoleButton = document.getElementById("clear-console");
const consoleElement = document.getElementById("console");
const previewFrame = document.getElementById("preview");

function updatePreview() {
  previewFrame.srcdoc = `
      ${htmlEditor.state.doc.toString()}
      <style>${cssEditor.state.doc.toString()}</style>
      <script>${jsEditor.state.doc.toString()}</script>
  `;
}

function runCode() {
  const js = jsEditor.state.doc.toString();
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
  // "Elegant" = our self-contained light theme; "Midnight" = oneDark.
  const themeExt = theme === "elegant" ? elegantTheme : oneDark;
  [htmlEditor, cssEditor, jsEditor].forEach((editor) => {
    editor.dispatch({ effects: themeCompartment.reconfigure(themeExt) });
  });

  if (theme === "midnight") {
    document.body.classList.remove("elegant-theme");
    document.body.classList.add("midnight-theme");
  } else if (theme === "elegant") {
    document.body.classList.remove("midnight-theme");
    document.body.classList.add("elegant-theme");
  }
}

runCodeButton.addEventListener("click", runCode);
clearConsoleButton.addEventListener("click", clearConsole);
themeSelect.addEventListener("change", changeTheme);

updatePreview();

// --- Snippet integration (snippets.js) -------------------------------------

// Current contents of the three editors, for saving a snippet.
export function getEditorContents() {
  return {
    html: htmlEditor.state.doc.toString(),
    css: cssEditor.state.doc.toString(),
    js: jsEditor.state.doc.toString(),
  };
}

// Replace all three editors' contents (loading a snippet). Each dispatch fires
// the HTML/CSS preview listeners; updatePreview() also runs explicitly so the
// JS pane (which has no listener) is reflected too.
export function setEditorContents({ html = "", css = "", js = "" }) {
  const replaceDoc = (view, text) =>
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  replaceDoc(htmlEditor, html);
  replaceDoc(cssEditor, css);
  replaceDoc(jsEditor, js);
  updatePreview();
}
