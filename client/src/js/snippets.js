// Snippets: save / load the editor sandbox (HTML + CSS + JS) to Firestore
// under users/{uid}/snippets. Save controls live on the editor toolbar; the
// saved-snippet list lives in the off-canvas navbar. Loaded after auth (see
// entries/app.js), so auth.currentUser is set when this initializes.
//
// "Current snippet" model: loading a snippet makes it current; Save overwrites
// the current one (or, if none is loaded, prompts for a name and creates one);
// Save as new always creates a fresh snippet and makes it current.

import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db, auth } from "./firebase.js";
import { getEditorContents, setEditorContents } from "./editor.js";
import { closeNavbar } from "./navbar.js";

const listEl = document.getElementById("snippet-list");
const saveBtn = document.getElementById("save-snippet");
const saveAsBtn = document.getElementById("save-snippet-as");
const activeLabel = document.getElementById("active-snippet");

const uid = auth.currentUser?.uid;

let latestSnippets = [];
let currentSnippetId = null;
let currentSnippetName = null;

function snippetsCol() {
  return collection(db, "users", uid, "snippets");
}

function setCurrent(id, name) {
  currentSnippetId = id;
  currentSnippetName = name;
  if (activeLabel) {
    activeLabel.textContent = name ? `Editing: ${name}` : "";
  }
  render();
}

async function saveAsNew() {
  const name = window.prompt("Name this snippet:");
  if (name === null) return; // cancelled
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    const ref = await addDoc(snippetsCol(), {
      name: trimmed,
      ...getEditorContents(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setCurrent(ref.id, trimmed);
  } catch (err) {
    console.error("Save snippet failed:", err);
  }
}

async function saveCurrent() {
  // No snippet loaded yet → first save behaves like "save as new".
  if (!currentSnippetId) {
    await saveAsNew();
    return;
  }
  try {
    await updateDoc(doc(db, "users", uid, "snippets", currentSnippetId), {
      ...getEditorContents(),
      updatedAt: serverTimestamp(),
    });
    flashActiveLabel();
  } catch (err) {
    console.error("Update snippet failed:", err);
  }
}

// Brief "Saved" confirmation on the toolbar label, then restore the name.
function flashActiveLabel() {
  if (!activeLabel) return;
  const name = currentSnippetName;
  activeLabel.textContent = `Saved “${name}” ✓`;
  setTimeout(() => {
    if (currentSnippetName === name) {
      activeLabel.textContent = name ? `Editing: ${name}` : "";
    }
  }, 1500);
}

async function loadSnippet(id) {
  try {
    const snap = await getDoc(doc(db, "users", uid, "snippets", id));
    if (!snap.exists()) return;
    const data = snap.data();
    setEditorContents({ html: data.html, css: data.css, js: data.js });
    setCurrent(id, data.name);
    closeNavbar();
  } catch (err) {
    console.error("Load snippet failed:", err);
  }
}

async function renameSnippet(id, name) {
  await updateDoc(doc(db, "users", uid, "snippets", id), { name });
}

async function deleteSnippet(id) {
  await deleteDoc(doc(db, "users", uid, "snippets", id));
  if (id === currentSnippetId) setCurrent(null, null);
}

function makeActionButton(iconClass, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "snippet-action";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = `<i class="${iconClass}"></i>`;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function beginRename(row, id, currentName) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "snippet-rename-input";
  input.value = currentName;
  input.maxLength = 200;

  let settled = false;
  const cancel = () => {
    if (settled) return;
    settled = true;
    render();
  };
  const commit = async () => {
    if (settled) return;
    settled = true;
    const name = input.value.trim();
    if (name && name !== currentName) {
      try {
        await renameSnippet(id, name);
        if (id === currentSnippetId) setCurrent(id, name);
      } catch (err) {
        console.error("Rename snippet failed:", err);
        render();
      }
    } else {
      render();
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  });
  input.addEventListener("blur", commit);

  row.replaceChildren(input);
  input.focus();
  input.select();
}

function render() {
  if (!latestSnippets.length) {
    const li = document.createElement("li");
    li.className = "snippet-empty";
    li.textContent = "No saved snippets yet.";
    listEl.replaceChildren(li);
    return;
  }

  const rows = latestSnippets.map(({ id, name }) => {
    const li = document.createElement("li");
    li.className = "snippet-item";
    if (id === currentSnippetId) li.classList.add("active");

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "snippet-title";
    titleBtn.textContent = name || "Untitled";
    titleBtn.title = name || "Untitled";
    titleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadSnippet(id);
    });

    const actions = document.createElement("span");
    actions.className = "snippet-actions";
    actions.append(
      makeActionButton("fa-solid fa-pen", "Rename", () =>
        beginRename(li, id, name || "")
      ),
      makeActionButton("fa-solid fa-trash", "Delete", async () => {
        if (!window.confirm(`Delete snippet "${name || "Untitled"}"?`)) return;
        try {
          await deleteSnippet(id);
        } catch (err) {
          console.error("Delete snippet failed:", err);
        }
      })
    );

    li.append(titleBtn, actions);
    return li;
  });

  listEl.replaceChildren(...rows);
}

function init() {
  if (!uid || !listEl) return;

  saveBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    saveCurrent();
  });
  saveAsBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    saveAsNew();
  });

  onSnapshot(
    query(snippetsCol(), orderBy("updatedAt", "desc")),
    (snap) => {
      latestSnippets = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
      }));
      render();
    },
    (err) => console.error("Snippets subscription failed:", err)
  );
}

init();
