// Entry for app.html — the chat + editor sandbox. Gated on Firebase Auth:
// signed-out visitors are redirected to /sign-in.html before the heavier
// app modules (chat, editor, navbar) are even loaded.
import "@fortawesome/fontawesome-free/css/all.min.css";

import "../theme.js";
import "../top-bar.js";
import { onAuthChange } from "../auth.js";

// Firebase fires onAuthChange asynchronously (it reads cached creds first),
// so we wait for the *first* resolution before deciding what to do. Subsequent
// fires (sign-out from the top bar, token refresh, etc.) are handled by
// top-bar.js or the SDK — not here.
let resolved = false;
onAuthChange(async (user) => {
  if (resolved) return;
  resolved = true;

  if (!user) {
    window.location.replace("/sign-in.html");
    return;
  }

  // Signed in — load the app modules now that we know the user is allowed.
  // curriculum.js imports chat.js + navbar.js; voice.js imports chat.js +
  // api.js — those dependencies evaluate first.
  const modules = [
    import("../navbar.js"),
    import("../chat.js"),
    import("../curriculum.js"),
    import("../profile.js"),
    import("../voice.js"),
  ];

  // The code editor + snippets are desktop-only: on mobile the app is a
  // chat-first tutor, so skip those imports entirely (keeps the CodeMirror
  // bundle off mobile). Mirrors the chat-only layout in the CSS. Crossing the
  // breakpoint needs a reload to switch modes — acceptable for a rare event.
  if (!window.matchMedia("(max-width: 1023px)").matches) {
    modules.push(import("../editor.js"), import("../snippets.js"));
  }

  await Promise.all(modules);
});
