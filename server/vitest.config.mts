import { defineConfig } from "vitest/config";

// Separate from tsconfig/build — never read by `npm run build` (prisma generate && tsc), so
// adding a test runner here carries zero risk to what actually ships. Only pure-function logic
// is tested (no real DB, no real filesystem image processing) — see
// shared/utils/imageThumbnails.test.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
