// localStorage-backed light/dark theme. Imported by every page entry so the
// chosen theme survives navigation between pages.

const STORAGE_KEY = "codefit-theme";

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme) {
  document.body.classList.toggle("light-mode", theme === "light");
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

export function toggleTheme() {
  setTheme(getTheme() === "light" ? "dark" : "light");
}

// Apply on import so pages don't flash the wrong theme before JS runs further.
applyTheme(getTheme());
