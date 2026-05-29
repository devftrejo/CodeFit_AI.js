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
  // conversations.js imports chat.js + navbar.js, so those evaluate first.
  await Promise.all([
    import("../navbar.js"),
    import("../editor.js"),
    import("../chat.js"),
    import("../conversations.js"),
  ]);
});
