import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Live tests against the real Supabase project (see tests/integration/*). Run with `npm run test:integration`. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
