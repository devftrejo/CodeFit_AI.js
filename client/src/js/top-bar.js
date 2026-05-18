import { getTheme, toggleTheme } from "./theme.js";

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

markActiveLink();
bindLightToggle();
