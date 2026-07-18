// Entry for assessment.html — the fit assessment that gates the app for new
// users. Loads shared chrome, then gates on auth (like entries/app.js): a
// signed-out visitor is bounced to /sign-in.html; a signed-in one gets the
// assessment flow (or, if they've already finished, a read-only re-view of
// their result).
import "@fortawesome/fontawesome-free/css/all.min.css";

import "../theme.js";
import "../top-bar.js";
import { onAuthChange } from "../auth.js";

let resolved = false;
onAuthChange(async (user) => {
  if (resolved) return;
  resolved = true;

  if (!user) {
    window.location.replace("/sign-in.html");
    return;
  }

  const { init } = await import("../assessment.js");
  init(user);
});
