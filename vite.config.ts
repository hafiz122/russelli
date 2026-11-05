import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(projectDirectory, "index.html"),
        practice: resolve(projectDirectory, "practice/index.html"),
        progress: resolve(projectDirectory, "progress/index.html"),
        changelog: resolve(projectDirectory, "changelog/index.html"),
        privacy: resolve(projectDirectory, "privacy/index.html"),
        terms: resolve(projectDirectory, "terms/index.html")
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"]
  }
});

