import { resolve } from "path";
// import { defineConfig } from "vite"; // Uncomment this line for the MPA version of the app.

// SPA Setup:

export default {
  root: resolve(__dirname, "src"),
  build: {
    outDir: "../dist",
  },
  server: {
    port: 8080,
  },
};

// MPA Setup:

// export default defineConfig({
//   root: resolve(__dirname, "src"),
//   build: {
//     outDir: "../dist",
//     rollupOptions: {
//       input: {
//         main: resolve(__dirname, "src/index.html"),
//         about: resolve(__dirname, "src/about.html"),
//         contact: resolve(__dirname, "src/contact.html"),
//       },
//     },
//   },
//   server: {
//     port: 8080,
//   },
// });
