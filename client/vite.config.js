import { resolve } from "path";
import { defineConfig } from "vite";

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
  },
});
