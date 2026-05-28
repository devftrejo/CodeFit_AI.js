// Entry for sign-in.html. Loads shared chrome (theme, top bar, Font Awesome)
// and then wires up the auth form. Signed-in users who hit this page are
// bounced straight to /app.html — no point showing them the form.
import "@fortawesome/fontawesome-free/css/all.min.css";

import "../theme.js";
import "../top-bar.js";

import {
  onAuthChange,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from "../auth.js";

const REDIRECT_AFTER_AUTH = "/app.html";

const form = document.getElementById("auth-form");
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const submitButton = document.getElementById("auth-submit");
const errorEl = document.getElementById("auth-error");
const googleButton = document.getElementById("auth-google");
const tabs = document.querySelectorAll(".auth-tab");

let mode = "sign-in";

function showError(message) {
  errorEl.textContent = message;
}

function clearError() {
  errorEl.textContent = "";
}

function setBusy(busy) {
  submitButton.disabled = busy;
  googleButton.disabled = busy;
  submitButton.textContent = busy
    ? "Working…"
    : mode === "sign-in"
      ? "Sign in"
      : "Create account";
}

function setMode(nextMode) {
  mode = nextMode;
  tabs.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  passwordInput.setAttribute(
    "autocomplete",
    mode === "sign-in" ? "current-password" : "new-password"
  );
  clearError();
  setBusy(false);
}

// Most Firebase auth errors arrive as { code, message } — code is stable and
// safer for messaging than the raw message string.
function friendlyAuthError(error) {
  const code = error?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account already exists for that email — try signing in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before finishing.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error?.message || "Something went wrong. Try again.";
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Email and password are both required.");
    return;
  }

  setBusy(true);
  try {
    if (mode === "sign-in") {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password);
    }
    // onAuthChange below will handle the redirect.
  } catch (error) {
    showError(friendlyAuthError(error));
    setBusy(false);
  }
});

googleButton.addEventListener("click", async () => {
  clearError();
  setBusy(true);
  try {
    await signInWithGoogle();
  } catch (error) {
    showError(friendlyAuthError(error));
    setBusy(false);
  }
});

// Single source of truth for "user is signed in" — both form submit and
// Google popup flow funnel through this.
onAuthChange((user) => {
  if (user) {
    window.location.replace(REDIRECT_AFTER_AUTH);
  }
});
