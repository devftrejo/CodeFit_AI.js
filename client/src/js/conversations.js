// Conversations menu (off-canvas navbar, app-only). Owns the Firestore reads
// for the conversation list + per-conversation messages, and drives the chat
// pane (chat.js) when the user creates, switches, renames, or deletes a
// conversation. Loaded after auth resolves (see entries/app.js), so
// auth.currentUser is set by the time this module initializes.

import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

import { db, auth } from "./firebase.js";
import {
  loadConversation,
  startNewConversation,
  getCurrentConversationId,
} from "./chat.js";
import { closeNavbar } from "./navbar.js";

const listEl = document.getElementById("conversation-list");
const newChatBtn = document.getElementById("new-chat-btn");

const uid = auth.currentUser?.uid;

// Latest conversation docs from the snapshot, newest-activity first.
let latestConversations = [];

function conversationsCol() {
  return collection(db, "users", uid, "conversations");
}

function messagesCol(id) {
  return collection(db, "users", uid, "conversations", id, "messages");
}

async function switchTo(id) {
  const snap = await getDocs(
    query(messagesCol(id), orderBy("createdAt", "asc"))
  );
  loadConversation(
    id,
    snap.docs.map((d) => d.data())
  );
  closeNavbar();
}

async function renameConversation(id, title) {
  await updateDoc(doc(db, "users", uid, "conversations", id), { title });
}

async function deleteConversation(id) {
  // The client SDK doesn't cascade subcollection deletes, so remove the
  // message docs first (batched, max 500 writes per batch) then the
  // conversation doc itself.
  const snap = await getDocs(messagesCol(id));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + 450)) batch.delete(d.ref);
    await batch.commit();
  }
  await deleteDoc(doc(db, "users", uid, "conversations", id));
}

function makeActionButton(iconClass, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "conversation-action";
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

// Swap a row's title for an input to rename in place. Commits on Enter/blur,
// cancels on Escape; a guard flag prevents the blur handler firing twice.
function beginRename(row, id, currentTitle) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "conversation-rename-input";
  input.value = currentTitle;
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
    const title = input.value.trim();
    if (title && title !== currentTitle) {
      try {
        await renameConversation(id, title);
        // The snapshot listener re-renders with the new title.
      } catch (err) {
        console.error("Rename failed:", err);
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

function renderEmpty() {
  const li = document.createElement("li");
  li.className = "conversation-empty";
  li.textContent = "No conversations yet.";
  listEl.replaceChildren(li);
}

function render() {
  if (!latestConversations.length) {
    renderEmpty();
    return;
  }

  const activeId = getCurrentConversationId();
  const rows = latestConversations.map(({ id, title }) => {
    const li = document.createElement("li");
    li.className = "conversation-item";
    if (id === activeId) li.classList.add("active");

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "conversation-title";
    // textContent (not innerHTML) — titles are user-controlled.
    titleBtn.textContent = title || "Untitled";
    titleBtn.title = title || "Untitled";
    titleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      switchTo(id);
    });

    const actions = document.createElement("span");
    actions.className = "conversation-actions";
    actions.append(
      makeActionButton("fa-solid fa-pen", "Rename", () =>
        beginRename(li, id, title || "")
      ),
      makeActionButton("fa-solid fa-trash", "Delete", async () => {
        if (!window.confirm(`Delete "${title || "Untitled"}"?`)) return;
        const wasActive = id === getCurrentConversationId();
        try {
          await deleteConversation(id);
          if (wasActive) startNewConversation();
        } catch (err) {
          console.error("Delete failed:", err);
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

  newChatBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    startNewConversation();
    closeNavbar();
  });

  // Re-highlight the active row when chat.js changes the current conversation
  // (new chat, switch, or the id assigned to a fresh conversation's 1st reply).
  document.addEventListener("conversation-changed", render);

  onSnapshot(
    query(conversationsCol(), orderBy("updatedAt", "desc")),
    (snap) => {
      latestConversations = snap.docs.map((d) => ({
        id: d.id,
        title: d.data().title,
      }));
      render();
    },
    (err) => console.error("Conversations subscription failed:", err)
  );
}

init();
