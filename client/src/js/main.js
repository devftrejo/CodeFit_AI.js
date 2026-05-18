// Font Awesome bundle — registers .fa-* icon classes used throughout the HTML.
import "@fortawesome/fontawesome-free/css/all.min.css";

// Entry point — order matters: navbar exports closeNavbar, which chat imports.
import "./navbar.js";
import "./editor.js";
import "./chat.js";
