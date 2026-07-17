// Off-canvas navbar — app-only. Contains app-specific menus (Curriculum,
// AI Roles). The top-bar handles cross-page navigation and the light/dark
// toggle, so neither lives here anymore.

const navbar = document.getElementById("navbar");
const toggleBtn = document.getElementById("toggleBtn");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

export function openNavbar() {
  navbar.classList.add("active");
  overlay.style.display = "block";
  toggleBtn.style.display = "none";
  closeBtn.style.display = "block";
}

export function closeNavbar() {
  navbar.classList.remove("active");
  overlay.style.display = "none";
  toggleBtn.style.display = "block";
  closeBtn.style.display = "none";
}

toggleBtn.addEventListener("click", openNavbar);
closeBtn.addEventListener("click", closeNavbar);
overlay.addEventListener("click", closeNavbar);

// Delegated so it also covers submenu toggles rendered after load — the
// Curriculum tree is built dynamically by curriculum.js from curriculum-data.js.
navbar.addEventListener("click", (e) => {
  const toggle = e.target.closest(".submenu-toggle");
  if (!toggle) return;
  e.preventDefault();
  const submenu = toggle.nextElementSibling;
  submenu.classList.toggle("active");
  const icon = toggle.querySelector(".fa-chevron-down, .fa-chevron-up");
  if (icon) {
    icon.classList.toggle("fa-chevron-down");
    icon.classList.toggle("fa-chevron-up");
  }
});
