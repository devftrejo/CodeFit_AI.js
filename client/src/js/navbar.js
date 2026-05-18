const navbar = document.getElementById("navbar");
const toggleBtn = document.getElementById("toggleBtn");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");
const submenuToggles = document.querySelectorAll(".submenu-toggle");
const lightModeToggle = document.getElementById("lightModeToggle");

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

submenuToggles.forEach((toggle) => {
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    const submenu = toggle.nextElementSibling;
    submenu.classList.toggle("active");
    const icon = toggle.querySelector(".fa-chevron-down, .fa-chevron-up");
    if (icon) {
      icon.classList.toggle("fa-chevron-down");
      icon.classList.toggle("fa-chevron-up");
    }
  });
});

lightModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  const icon = lightModeToggle.querySelector("i");
  if (document.body.classList.contains("light-mode")) {
    icon.classList.replace("fa-sun", "fa-moon");
    lightModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> Dark Mode';
  } else {
    icon.classList.replace("fa-moon", "fa-sun");
    lightModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i> Light Mode';
  }
});
