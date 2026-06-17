import js from "@eslint/js";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", ".git/**"],
  },
  js.configs.recommended,
  // Duplicate- and dead-code detection (scoped to our source, not config files).
  // A focused subset of eslint-plugin-sonarjs — not its full recommended set,
  // which adds many broader code-smell rules beyond this repo's goal.
  {
    files: ["client/src/**/*.js", "functions/**/*.js"],
    plugins: { sonarjs },
    rules: {
      // Duplicate code
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-identical-conditions": "error",
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/no-duplicated-branches": "error",
      // Dead / unused code
      "sonarjs/no-dead-store": "error",
      "sonarjs/no-unused-collection": "error",
      "sonarjs/no-element-overwrite": "error",
      "sonarjs/no-gratuitous-expressions": "error",
      "sonarjs/no-redundant-jump": "error",
    },
  },
  {
    files: ["client/src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["client/vite.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["functions/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
];
