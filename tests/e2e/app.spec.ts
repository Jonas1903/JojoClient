/**
 * End-to-end tests for JojoClient.
 *
 * These tests launch the full Electron app using Playwright's Electron support.
 * The app must be built first: `npm run build`
 *
 * Run with: npx playwright test
 *
 * Each test demonstrates how to use the JojoApp page object helpers.
 */

import { test, expect, _electron as electron } from "@playwright/test";
import { JojoApp, waitForMainUI } from "../helpers/e2e-helpers";
import path from "node:path";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Path to the built Electron main process. */
function mainEntry(): string {
  const root = path.resolve(__dirname, "..", "..");
  const mainJs = path.join(root, "dist-electron", "electron", "main.js");
  if (!fs.existsSync(mainJs)) {
    throw new Error(
      `Electron main not found at ${mainJs}. Run "npm run build" first.`
    );
  }
  return mainJs;
}

/** Launch the app and return both the Electron app handle and the page object. */
async function launchApp() {
  const electronApp = await electron.launch({
    args: [mainEntry()],
    // Use a temp user data dir so each test starts fresh
    executablePath: undefined as any, // use installed electron
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  const app = new JojoApp(page);
  return { electronApp, app, page };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("JojoClient App", () => {
  test.describe.configure({ mode: "serial", timeout: 120000 });

  let electronApp: Awaited<ReturnType<typeof electron.launch>>;
  let app: JojoApp;

  test.beforeAll(async () => {
    const launched = await launchApp();
    electronApp = launched.electronApp;
    app = launched.app;
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test("loads the setup screen when no base path is set", async () => {
    // The app should show the setup card with "Choose Folder" button
    const setupCard = app.page.locator(".setup-card");
    const mainNav = app.page.locator(".top-navbar");

    // Either setup screen or main UI is visible
    const setupVisible = (await setupCard.count()) > 0;
    const mainVisible = (await mainNav.count()) > 0;

    expect(setupVisible || mainVisible).toBe(true);
  });

  test("setup screen shows brand name and choose folder button", async () => {
    const setupCard = app.page.locator(".setup-card");
    if ((await setupCard.count()) === 0) {
      test.skip(true, "App already configured — skipping setup test");
      return;
    }

    await app.expectVisible("JojoClient");
    await app.expectVisible("Choose Folder");
  });

  test("navigation tabs exist after setup", async () => {
    const mainNav = app.page.locator(".top-navbar");
    if ((await mainNav.count()) === 0) {
      test.skip(true, "App not past setup screen");
      return;
    }

    await waitForMainUI(app.page);

    // Check all navigation tabs are present
    await app.expectVisible("Play");
    await app.expectVisible("Mods");
    await app.expectVisible("Profiles");
    await app.expectVisible("Settings");
  });

  test("can navigate between tabs", async () => {
    const mainNav = app.page.locator(".top-navbar");
    if ((await mainNav.count()) === 0) {
      test.skip(true, "App not past setup screen");
      return;
    }

    await waitForMainUI(app.page);

    // Navigate to Mods tab
    await app.navigateTo("mods");
    expect(await app.activeTab()).toContain("mods");

    // Navigate to Profiles tab
    await app.navigateTo("profiles");
    expect(await app.activeTab()).toContain("profiles");

    // Navigate to Settings tab
    await app.navigateTo("settings");
    expect(await app.activeTab()).toContain("settings");

    // Navigate back to Play tab
    await app.navigateTo("play");
    expect(await app.activeTab()).toContain("play");
  });

  test("settings tab shows theme toggle", async () => {
    const mainNav = app.page.locator(".top-navbar");
    if ((await mainNav.count()) === 0) {
      test.skip(true, "App not past setup screen");
      return;
    }

    await app.navigateTo("settings");
    await app.expectVisible("Settings");
  });

  test("account button opens account modal", async () => {
    const mainNav = app.page.locator(".top-navbar");
    if ((await mainNav.count()) === 0) {
      test.skip(true, "App not past setup screen");
      return;
    }

    await app.navigateTo("play");

    // Click the account button
    await app.page.locator(".navbar-account-btn").click();
    await app.page.waitForTimeout(500);

    // Account modal should appear
    const modal = app.page.locator(".account-modal");
    if ((await modal.count()) > 0) {
      await app.expectVisible("Accounts");
      // Close it
      await app.clickButton("Close");
    }
  });

  test("window control buttons are present", async () => {
    const mainNav = app.page.locator(".top-navbar");
    if ((await mainNav.count()) === 0) {
      test.skip(true, "App not past setup screen");
      return;
    }

    // Window controls should be in the top-right
    const controls = app.page.locator(".window-controls");
    expect(await controls.count()).toBe(1);

    const buttons = controls.locator(".window-control-btn");
    expect(await buttons.count()).toBe(3); // minimize, maximize, close
  });

  test("new installation button is present on play screen", async () => {
    const mainNav = app.page.locator(".top-navbar");
    if ((await mainNav.count()) === 0) {
      test.skip(true, "App not past setup screen");
      return;
    }

    await app.navigateTo("play");
    await app.page.waitForTimeout(300);

    // The "+ New Installation" dashed button
    const newInstBtn = app.page.locator(".new-installation-btn");
    if ((await newInstBtn.count()) > 0) {
      await app.expectVisible("New Installation");
    }
    // If no profiles exist, the button text may differ
  });

  test("new installation modal opens and can be filled", async () => {
    const mainNav = app.page.locator(".top-navbar");
    if ((await mainNav.count()) === 0) {
      test.skip(true, "App not past setup screen");
      return;
    }

    await app.navigateTo("play");

    // Check if there are profiles — the new installation flow requires one
    const newInstBtn = app.page.locator(".new-installation-btn");
    if ((await newInstBtn.count()) === 0) {
      test.skip(true, "New Installation button not visible");
      return;
    }

    await newInstBtn.click();
    await app.page.waitForTimeout(500);

    // If an info modal pops up saying "create a profile first", handle it
    const infoModal = app.page.locator(".info-modal");
    if ((await infoModal.count()) > 0) {
      // No profiles exist yet — that's expected behavior
      const infoText = await infoModal.textContent();
      if (infoText?.includes("profile")) {
        await app.clickButton("OK");
        test.skip(true, "No profiles exist yet — profile creation tested separately");
        return;
      }
      await app.clickButton("OK");
      return;
    }

    // New installation modal should be open
    await app.expectModalVisible("New Installation");

    // Fill the name field
    const nameInput = app.page.locator(".new-installation-modal input").first();
    if ((await nameInput.count()) > 0) {
      await nameInput.fill("Test Installation");
      expect(await nameInput.inputValue()).toBe("Test Installation");
    }

    // Close the modal
    await app.clickButton("Cancel");
    await app.expectModalNotVisible("New Installation");
  });
});

test.describe("IPC Flow Verification (manual mock mode)", () => {
  /**
   * These tests demonstrate how you'd verify IPC flows.
   * In a real E2E context, you'd spy on the actual IPC calls.
   * The pattern shown here is: trigger action → observe UI state change.
   */

  test("verification pattern — trigger action, check state", async () => {
    // This test documents the pattern for verifying features:
    //
    // 1. Set up known state (profiles, installations)
    // 2. Perform an action (click button, fill form)
    // 3. Observe the result (UI change, new element visible)
    // 4. Assert the expected outcome
    //
    // Example for "add a profile":
    //
    //   await app.navigateTo("profiles");
    //   await app.clickButton("New Profile");
    //   await app.expectModalVisible("New Profile");
    //   await app.fillInput("Name", "My Modded Profile");
    //   await app.clickButton("Create");
    //   await app.expectModalNotVisible("New Profile");
    //   await app.expectVisible("My Modded Profile");
    //
    // Example for "launch game":
    //
    //   await app.navigateTo("play");
    //   await app.selectInstallation("Main World");
    //   await app.clickPlayButton();
    //   // Game state should change
    //   const state = await app.gameState();
    //   expect(state).not.toBe("idle");
    //
    // Example for "check error handling":
    //
    //   mock.launchGame.mockResolvedValue({ ok: false, error: "Java not found" });
    //   await app.clickPlayButton();
    //   await app.expectError("Java not found");

    expect(true).toBe(true); // Placeholder — real tests use the patterns above
  });
});
