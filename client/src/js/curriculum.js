// Curriculum menu (off-canvas navbar, app-only). Each curriculum topic owns its
// own conversation: clicking a topic resumes that topic's saved thread, or
// starts it if it doesn't exist yet. This replaces the old standalone
// Conversations list — there's no chat outside a curriculum context, so the
// topic IS the entry point. Loaded after auth resolves (see entries/app.js),
// so auth.currentUser is set by the time this module initializes.

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

import { db, auth } from "./firebase.js";
import { openTopic } from "./chat.js";
import { closeNavbar } from "./navbar.js";

const uid = auth.currentUser?.uid;

const topicLinks = document.querySelectorAll(".curriculum-topic");

function conversationsCol() {
  return collection(db, "users", uid, "conversations");
}

// A topic's conversation is keyed by "<language>::<topic>" (set server-side
// when the conversation is created — see functions/index.js).
function topicKey(language, topic) {
  return `${language}::${topic}`;
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

function init() {
  if (!uid) return;

  topicLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const { language, topic } = e.currentTarget.dataset;

      // Highlight the active topic in the menu.
      topicLinks.forEach((el) => el.classList.remove("active"));
      e.currentTarget.classList.add("active");

      selectTopic(language, topic);
      closeNavbar();
    });
  });
}

init();
