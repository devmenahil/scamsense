import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Live tests against the real Supabase project (see tests/integration/*). Run with `npm run test:integration`. */
export default defineConfig({
  // PDF documents are React components (.tsx); Next uses jsx "preserve", so tests transform JSX themselves.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server-only modules (answer keys, data access) are unit-tested in Node; the guard itself is a build check.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
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
