import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  retries: 0,
  workers: 1, // Electron apps can only have one instance
  reporter: [[process.env.CI ? "dot" : "list"], ["html", { open: "never" }]],

  use: {
    screenshot: "only-on-failure",
    video: "off",
    trace: "on-first-retry",
  },

  // Electron-specific: we don't use webServer or browser config here.
  // Tests use the _electron fixture from playwright.
});
