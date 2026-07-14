import { defineConfig } from "vitest/config";

// Minimal test setup: everything we test is pure logic or mockable I/O, so it
// all runs in the Node environment (no jsdom). Tests live next to the code they
// cover as *.test.js, in both workspaces.
export default defineConfig({
  test: {
    environment: "node",
    include: ["client/src/**/*.test.js", "functions/**/*.test.js"],
  },
});
