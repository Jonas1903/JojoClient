import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default to node for service tests. Component tests override
    // via @vitest-environment jsdom docblock.
    environment: "node",
    globals: true,
    setupFiles: [],
    // E2E tests use Playwright's own test runner, not Vitest.
    exclude: ["tests/e2e/**", "node_modules/**", ".kilo/**"],
  },
});
