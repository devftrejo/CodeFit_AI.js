import { getTheme, toggleTheme } from "./theme.js";
import { onAuthChange, signOut } from "./auth.js";

// Highlights the current page in the top-bar nav (matches the link whose href
// resolves to the current pathname). Defaults to index.html for `/`.

function markActiveLink() {
  const here = window.location.pathname.replace(/\/$/, "") || "/index.html";
  document.querySelectorAll(".top-bar-nav a").forEach((link) => {
    const target =
      new URL(link.href).pathname.replace(/\/$/, "") || "/index.html";
    if (target === here) link.classList.add("active");
  });
}

function bindLightToggle() {
  const button = document.getElementById("top-bar-light-toggle");
  if (!button) return;

  const render = () => {
    const isLight = getTheme() === "light";
    button.innerHTML = isLight
      ? '<i class="fa-solid fa-moon"></i> Dark Mode'
      : '<i class="fa-solid fa-sun"></i> Light Mode';
  };

  render();
  button.addEventListener("click", toggleTheme);
  document.addEventListener("themechange", render);
}

// On mobile the nav collapses behind a toggle (it overflows the bar otherwise).
// The button shows/hides the nav dropdown; it's hidden via CSS on desktop, where
// the nav is always visible. Tapping a link or outside the menu closes it.
function bindMenuToggle() {
  const toggle = document.getElementById("top-bar-menu-toggle");
  const nav = document.getElementById("top-bar-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(!nav.classList.contains("open"));
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && !toggle.contains(event.target)) {
      setOpen(false);
    }
  });
}

// Render the auth slot based on the current Firebase user. Re-renders whenever
// auth state changes (sign-in, sign-out, token refresh that adds claims).
function bindAuthSlot() {
  const slot = document.getElementById("top-bar-auth");
  if (!slot) return;

  slot.classList.add("top-bar-auth");

  const renderSignedIn = (user) => {
    slot.innerHTML = "";
    const label = document.createElement("span");
    label.className = "top-bar-auth-email";
    label.textContent = user.email || user.displayName || "Signed in";
    label.title = user.email || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "top-bar-auth-button";
    button.textContent = "Sign out";
    button.addEventListener("click", async () => {
      try {
        await signOut();
        // After sign-out, kick the user back to the landing page so anyone
        // logged out of app.html doesn't stare at an empty, gated UI.
        window.location.replace("/");
      } catch (error) {
        console.error("Sign-out failed:", error);
      }
    });
    slot.append(label, button);
  };

  const renderSignedOut = () => {
    slot.innerHTML = "";
    const link = document.createElement("a");
    link.className = "top-bar-auth-link";
    link.href = "/sign-in.html";
    link.textContent = "Sign in";
    slot.append(link);
  };

  onAuthChange((user) => {
    if (user) renderSignedIn(user);
    else renderSignedOut();
  });
}

markActiveLink();
bindLightToggle();
bindMenuToggle();
bindAuthSlot();
