// Curriculum menu (off-canvas navbar, app-only). The whole Curriculum tree is
// rendered from curriculum-data.js — one source of truth for the menu, each
// topic's lesson kickoff, and progress. Each topic owns its own conversation:
// clicking a topic resumes that topic's saved thread, or starts it fresh. There
// is no chat outside a curriculum context, so the topic IS the entry point.
//
// Progress: a topic is marked complete once it gets its first successful AI
// reply (chat.js dispatches "topic-progress"). Completion is stored on the
// users/{uid} profile doc under `progress` (a map of topicKey -> true) — plain
// client read/write under the owner rule, same as the rest of the profile.
// Loaded after auth resolves (see entries/app.js), so auth.currentUser is set.

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db, auth } from "./firebase.js";
import { openTopic } from "./chat.js";
import { closeNavbar } from "./navbar.js";
import { CURRICULUM, allTopics, topicKey } from "./curriculum-data.js";

const uid = auth.currentUser?.uid;

const menuRoot = document.getElementById("curriculum-menu");

// topicKeys the user has completed, mirrored locally so ticks + the counter
// update without re-reading Firestore.
const completed = new Set();

function conversationsCol() {
  return collection(db, "users", uid, "conversations");
}

function profileRef() {
  return doc(db, "users", uid);
}

// Resolve the conversation for a topic, if one exists. One thread per topic, so
// we take the single match (limit 1).
async function findTopicConversation(language, topic) {
  const snap = await getDocs(
    query(
      conversationsCol(),
      where("topicKey", "==", topicKey(language, topic)),
      limit(1)
    )
  );
  return snap.docs[0] ?? null;
}

async function selectTopic(language, topic) {
  let conversationId = null;
  let messages = [];

  try {
    const convDoc = await findTopicConversation(language, topic);
    if (convDoc) {
      conversationId = convDoc.id;
      const msgSnap = await getDocs(
        query(collection(convDoc.ref, "messages"), orderBy("createdAt", "asc"))
      );
      messages = msgSnap.docs.map((d) => d.data());
    }
  } catch (err) {
    // Fall back to starting the topic fresh rather than blocking the learner.
    console.error("Loading topic conversation failed:", err);
  }

  openTopic({ language, topic, conversationId, messages });
}

// --- Rendering -------------------------------------------------------------

// Build one topic row: a clickable link plus a (hidden until completed) tick.
function renderTopic(language, topic) {
  const li = document.createElement("li");

  const link = document.createElement("a");
  link.href = "#";
  link.className = "curriculum-topic";
  link.dataset.language = language;
  link.dataset.topic = topic;

  const name = document.createElement("span");
  name.className = "topic-name";
  name.textContent = topic;

  const check = document.createElement("i");
  check.className = "fa-solid fa-circle-check topic-check";
  check.setAttribute("aria-hidden", "true");

  link.append(name, check);
  li.appendChild(link);
  return li;
}

// Build one language track: a collapsible toggle whose submenu holds each
// module (a non-clickable label) followed by that module's topic rows.
function renderTrack(track) {
  const li = document.createElement("li");
  li.innerHTML = `
    <a href="#" class="submenu-toggle">
      <i class="fa-solid ${track.icon}"></i> ${track.language}
      <i class="fa-solid fa-chevron-down"></i>
    </a>
    <ul class="submenu"></ul>`;

  const submenu = li.querySelector(".submenu");
  for (const module of track.modules) {
    const label = document.createElement("li");
    label.className = "curriculum-module-label";
    label.textContent = module.name;
    submenu.appendChild(label);

    for (const t of module.topics) {
      submenu.appendChild(renderTopic(track.language, t.topic));
    }
  }
  return li;
}

// The "X / N complete" counter shown at the top of the Curriculum menu.
let progressLabel;
function renderProgressCounter() {
  const li = document.createElement("li");
  li.className = "curriculum-progress";
  progressLabel = document.createElement("span");
  li.appendChild(progressLabel);
  return { li };
}

function updateProgressCounter() {
  if (!progressLabel) return;
  progressLabel.textContent = `${completed.size} / ${allTopics().length} complete`;
}

// Reflect a topic's completed state on its menu row.
function markRowComplete(language, topic) {
  const link = menuRoot.querySelector(
    `.curriculum-topic[data-language="${CSS.escape(language)}"][data-topic="${CSS.escape(topic)}"]`
  );
  link?.classList.add("completed");
}

function renderMenu() {
  menuRoot.innerHTML = "";
  const { li } = renderProgressCounter();
  menuRoot.appendChild(li);
  for (const track of CURRICULUM) {
    menuRoot.appendChild(renderTrack(track));
  }
  updateProgressCounter();
}

// --- Progress persistence --------------------------------------------------

async function loadProgress() {
  try {
    const snap = await getDoc(profileRef());
    const stored = snap.exists() ? (snap.data().progress ?? {}) : {};
    for (const t of allTopics()) {
      if (stored[topicKey(t.language, t.topic)]) {
        completed.add(topicKey(t.language, t.topic));
        markRowComplete(t.language, t.topic);
      }
    }
    updateProgressCounter();
  } catch (err) {
    console.error("Loading curriculum progress failed:", err);
  }
}

async function markComplete(language, topic) {
  const key = topicKey(language, topic);
  if (completed.has(key)) return; // already done — no redundant write

  completed.add(key);
  markRowComplete(language, topic);
  updateProgressCounter();

  try {
    // merge:true deep-merges the `progress` map, so this adds one key without
    // clobbering other completions or the rest of the profile doc.
    await setDoc(
      profileRef(),
      { progress: { [key]: true }, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error("Saving curriculum progress failed:", err);
  }
}

// --- Wiring ----------------------------------------------------------------

function init() {
  if (!uid || !menuRoot) return;

  renderMenu();
  loadProgress();

  // Topic clicks (delegated — the menu is rendered dynamically above).
  menuRoot.addEventListener("click", (e) => {
    const link = e.target.closest(".curriculum-topic");
    if (!link) return;
    e.preventDefault();

    const { language, topic } = link.dataset;

    // Highlight the active topic in the menu.
    menuRoot
      .querySelectorAll(".curriculum-topic.active")
      .forEach((el) => el.classList.remove("active"));
    link.classList.add("active");

    selectTopic(language, topic);
    closeNavbar();
  });

  // A successful reply in a topic marks it complete (chat.js fires this).
  document.addEventListener("topic-progress", (e) => {
    const { language, topic } = e.detail ?? {};
    if (language && topic) markComplete(language, topic);
  });
}

init();
