import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** LIVE Gemini verification (tests/gemini/*). Run with `npm run test:gemini`; uses the real GEMINI_* settings. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/gemini/**/*.test.ts"],
    environment: "node",
    testTimeout: 400_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
