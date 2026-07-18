import { resolve } from "path";
import { defineConfig } from "vite";
import handlebars from "vite-plugin-handlebars";

// Functions emulator URL — keep in sync with .firebaserc and any region change.
const FUNCTIONS_EMULATOR_TARGET = "http://127.0.0.1:5001";
const FUNCTIONS_PATH_PREFIX = "/codefit-ai-js/us-central1";

// Per-page <title>, injected into the shared `head` partial (src/partials/).
// The shared <head> and `.top-bar` markup live in those partials and are
// included via {{> head }} / {{> top-bar }} so they're authored once, not
// copy-pasted into all five pages.
const PAGE_TITLES = {
  "index.html": "CodeFit_AI.js — AI-powered JavaScript bootcamp",
  "app.html": "App · CodeFit_AI.js",
  "assessment.html": "Fit Assessment · CodeFit_AI.js",
  "about.html": "About · CodeFit_AI.js",
  "contact.html": "Contact · CodeFit_AI.js",
  "sign-in.html": "Sign in · CodeFit_AI.js",
};

export default defineConfig({
  root: resolve(__dirname, "src"),
  // .env files live at the package root (client/), not the Vite root
  // (client/src), so point env loading there — otherwise client/.env.production
  // is ignored and prod falls back to /api/chat (which Hosting buffers, breaking
  // SSE streaming). Keep in sync with where .env.example lives.
  envDir: __dirname,
  plugins: [
    handlebars({
      partialDirectory: resolve(__dirname, "src/partials"),
      context(pagePath) {
        const file = pagePath.split(/[\\/]/).pop();
        return { title: PAGE_TITLES[file] ?? "CodeFit_AI.js" };
      },
    }),
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        app: resolve(__dirname, "src/app.html"),
        assessment: resolve(__dirname, "src/assessment.html"),
        about: resolve(__dirname, "src/about.html"),
        contact: resolve(__dirname, "src/contact.html"),
        signIn: resolve(__dirname, "src/sign-in.html"),
      },
    },
  },
  server: {
    port: 8080,
    // Same-origin /api/<fn> works in dev (proxy to the Functions emulator) and
    // prod (the client calls the functions directly via VITE_API_URL). One entry
    // per function the client calls — chat plus the voice STT/TTS endpoints.
    proxy: Object.fromEntries(
      ["chat", "transcribe", "speak"].map((fn) => [
        `/api/${fn}`,
        {
          target: FUNCTIONS_EMULATOR_TARGET,
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(`/api/${fn}`, `${FUNCTIONS_PATH_PREFIX}/${fn}`),
        },
      ])
    ),
  },
});
