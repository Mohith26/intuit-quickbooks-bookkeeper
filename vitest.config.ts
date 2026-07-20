import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // All tests share one local Postgres instance and testHelpers.cleanupTestData
    // does a broad "TEST-" prefix sweep, so test *files* must not run
    // concurrently against each other (within-file tests already run serially).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
