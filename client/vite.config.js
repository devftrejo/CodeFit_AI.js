import { resolve } from "path";
import { defineConfig } from "vite";

// Functions emulator URL — keep in sync with .firebaserc and any region change.
const FUNCTIONS_EMULATOR_TARGET = "http://127.0.0.1:5001";
const FUNCTIONS_PATH_PREFIX = "/codefit-ai-js/us-central1";

export default defineConfig({
  root: resolve(__dirname, "src"),
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        app: resolve(__dirname, "src/app.html"),
        about: resolve(__dirname, "src/about.html"),
        contact: resolve(__dirname, "src/contact.html"),
      },
    },
  },
  server: {
    port: 8080,
    // Same-origin /api/chat works in dev (proxy to Functions emulator) and
    // prod (Firebase Hosting rewrite to the deployed function), so client
    // code can use a single relative path.
    proxy: {
      "/api/chat": {
        target: FUNCTIONS_EMULATOR_TARGET,
        changeOrigin: true,
        rewrite: (path) =>
          path.replace("/api/chat", `${FUNCTIONS_PATH_PREFIX}/chat`),
      },
    },
  },
});
