import path from "node:path";
import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts (the production build config) rather than merging a
// `test` block into it — this file is never read by `vite build`, so adding a test runner here
// carries zero risk to what actually ships. Default environment is plain Node (everything tested
// here is pure functions/stores, not rendered React components); the one test file that does
// need a DOM (dispatching visibilitychange/online events) opts in per-file with a
// `// @vitest-environment jsdom` comment instead of paying that cost for every test.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
