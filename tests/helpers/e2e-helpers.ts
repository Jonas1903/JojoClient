/**
 * E2E test helpers for Playwright + Electron.
 *
 * Provides a semantic page-object API on top of Playwright's Page:
 *   const app = new JojoApp(page);
 *   await app.clickButton("Play");
 *   await app.fillInput("Name", "My Installation");
 *   await app.expectVisible("Main World");
 *   await app.navigateTo("profiles");
 *
 * All selectors use data-testid, text content, or CSS classes.
 */

import type { Page, ElectronApplication } from "playwright";

// ---------------------------------------------------------------------------
// JojoApp — page object for the main app window
// ---------------------------------------------------------------------------

export class JojoApp {
  constructor(public page: Page) {}

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  /** Click a navbar tab by its label text (case-insensitive). */
  async navigateTo(tab: "play" | "mods" | "profiles" | "settings" | "partner"): Promise<void> {
    await this.page.locator(".navbar-tab", { hasText: new RegExp(tab, "i") }).click();
    await this.page.waitForTimeout(200);
  }

  /** Returns the currently active tab name. */
  async activeTab(): Promise<string> {
    const el = this.page.locator(".navbar-tab.active");
    return (await el.textContent())?.trim().toLowerCase() ?? "";
  }

  // -----------------------------------------------------------------------
  // Click helpers
  // -----------------------------------------------------------------------

  /** Click a button by its visible text (case-insensitive, trimmed). */
  async clickButton(label: string): Promise<void> {
    await this.page
      .locator("button", { hasText: new RegExp(`^\\s*${this.escapeRegex(label)}\\s*$`, "i") })
      .first()
      .click();
    await this.page.waitForTimeout(100);
  }

  /** Click a button that contains the given text (partial match). */
  async clickButtonContaining(label: string): Promise<void> {
    await this.page.locator("button", { hasText: label }).first().click();
    await this.page.waitForTimeout(100);
  }

  /** Click an element by data-testid. */
  async clickTestId(testId: string): Promise<void> {
    await this.page.locator(`[data-testid="${testId}"]`).click();
    await this.page.waitForTimeout(100);
  }

  /** Click the play button for a specific installation. */
  async clickPlayButton(installationName?: string): Promise<void> {
    if (installationName) {
      // Select the installation first
      await this.page.locator(".installation-item", { hasText: installationName }).click();
      await this.page.waitForTimeout(100);
    }
    await this.clickTestId("play-button");
  }

  // -----------------------------------------------------------------------
  // Form input helpers
  // -----------------------------------------------------------------------

  /** Fill an input by its associated label text. */
  async fillInput(label: string, value: string): Promise<void> {
    // Try to find input near the label
    const group = this.page.locator(".form-group", { hasText: label });
    const input = group.locator("input").first();
    if ((await input.count()) > 0) {
      await input.fill(value);
      return;
    }
    // Fallback: find by placeholder or data-testid
    await this.page.locator(`[data-testid="input-${label.toLowerCase().replace(/\s+/g, "-")}"]`).fill(value);
  }

  /** Select an option from a dropdown by its label text. */
  async selectOption(label: string, value: string): Promise<void> {
    const group = this.page.locator(".form-group", { hasText: label });
    const select = group.locator("select").first();
    if ((await select.count()) > 0) {
      await select.selectOption({ label: value });
      return;
    }
    // Custom dropdown pattern: click trigger then click option
    await group.locator(".custom-select-trigger, .dropdown-trigger").first().click();
    await this.page.locator(".dropdown-option, .version-option", { hasText: value }).first().click();
  }

  /** Type into the version search input and select a result. */
  async selectVersion(version: string): Promise<void> {
    await this.page.locator('[data-testid="version-search"]').fill(version);
    await this.page.locator(".version-option, .dropdown-option", { hasText: version }).first().click();
  }

  // -----------------------------------------------------------------------
  // Visibility assertions
  // -----------------------------------------------------------------------

  /** Assert text is visible on the page. */
  async expectVisible(text: string): Promise<void> {
    await this.page.locator(`text=${text}`).first().waitFor({ state: "visible", timeout: 5000 });
  }

  /** Assert text is NOT visible on the page. */
  async expectNotVisible(text: string): Promise<void> {
    await this.page.locator(`text=${text}`).first().waitFor({ state: "hidden", timeout: 5000 });
  }

  /** Assert an element with data-testid is visible. */
  async expectTestIdVisible(testId: string): Promise<void> {
    await this.page.locator(`[data-testid="${testId}"]`).waitFor({ state: "visible", timeout: 5000 });
  }

  /** Assert a modal with the given title is visible. */
  async expectModalVisible(title: string): Promise<void> {
    await this.page.locator(".modal h3", { hasText: title }).waitFor({ state: "visible", timeout: 5000 });
  }

  /** Assert a modal with the given title is NOT visible. */
  async expectModalNotVisible(title: string): Promise<void> {
    await this.page.locator(".modal h3", { hasText: title }).waitFor({ state: "hidden", timeout: 5000 });
  }

  /** Wait for an element with the given CSS class to be visible. */
  async expectClassVisible(className: string): Promise<void> {
    await this.page.locator(`.${className}`).first().waitFor({ state: "visible", timeout: 5000 });
  }

  // -----------------------------------------------------------------------
  // State helpers
  // -----------------------------------------------------------------------

  /** Get the current game state by checking the Play button's appearance. */
  async gameState(): Promise<"idle" | "downloading" | "running"> {
    const btn = this.page.locator('[data-testid="play-button"]');
    const text = (await btn.textContent())?.trim().toLowerCase() ?? "";
    if (text.includes("running")) return "running";
    if (text.includes("downloading")) return "downloading";
    return "idle";
  }

  /** Wait until the game state changes to the given value. */
  async waitForGameState(state: "idle" | "downloading" | "running", timeout = 10000): Promise<void> {
    const btn = this.page.locator('[data-testid="play-button"]');
    const pattern = state === "idle" ? /Play/i : state === "running" ? /Running/i : /Downloading/i;
    await btn.locator("text", { hasText: pattern }).waitFor({ state: "visible", timeout });
  }

  /** Wait for the error banner to appear containing the given text. */
  async expectError(text: string): Promise<void> {
    await this.page.locator(".error-banner", { hasText: text }).waitFor({ state: "visible", timeout: 5000 });
  }

  /** Wait for the error banner to disappear. */
  async expectNoError(): Promise<void> {
    await this.page.locator(".error-banner").waitFor({ state: "hidden", timeout: 5000 });
  }

  /** Dismiss the error banner. */
  async dismissError(): Promise<void> {
    await this.page.locator(".error-banner button").click();
  }

  // -----------------------------------------------------------------------
  // Modal interaction
  // -----------------------------------------------------------------------

  /** Close any open modal by clicking the overlay. */
  async closeModal(): Promise<void> {
    await this.page.locator(".modal-overlay").first().click({ position: { x: 10, y: 10 } });
    await this.page.waitForTimeout(300);
  }

  /** Confirm a confirmation dialog (click the danger/confirm button). */
  async confirmDialog(): Promise<void> {
    await this.page.locator(".confirm-modal .btn-danger, .confirm-modal .btn-primary").click();
    await this.page.waitForTimeout(300);
  }

  /** Cancel a confirmation dialog. */
  async cancelDialog(): Promise<void> {
    await this.page.locator(".confirm-modal .btn-cancel, .confirm-modal .btn-secondary").click();
    await this.page.waitForTimeout(300);
  }

  // -----------------------------------------------------------------------
  // Installation selection
  // -----------------------------------------------------------------------

  /** Select an installation in the sidebar by name. */
  async selectInstallation(name: string): Promise<void> {
    await this.page.locator(".installation-item", { hasText: name }).click();
    await this.page.waitForTimeout(200);
  }

  /** Returns the name of the currently selected installation. */
  async selectedInstallationName(): Promise<string> {
    return (await this.page.locator(".installation-item.selected .installation-name").textContent())?.trim() ?? "";
  }

  // -----------------------------------------------------------------------
  // Screenshot (for debugging)
  // -----------------------------------------------------------------------

  async screenshot(name: string): Promise<Buffer> {
    const fs = await import("fs");
    const dir = "tests/screenshots";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return await this.page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
  }

  // -----------------------------------------------------------------------
  // Setup screen
  // -----------------------------------------------------------------------

  /** On the setup screen, choose a folder. */
  async chooseFolder(): Promise<void> {
    await this.clickButton("Choose Folder");
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// ---------------------------------------------------------------------------
// App launcher
// ---------------------------------------------------------------------------

/**
 * Launch the JojoClient Electron app and return a JojoApp page object.
 * Requires the app to be built first (`npm run build`).
 */
export async function launchJojoApp(electronApp: ElectronApplication): Promise<JojoApp> {
  const page = await electronApp.firstWindow();
  // Wait for the app to finish loading
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // The setup screen should appear if no basePath is set.
  // The app may already have a basePath from previous runs.
  const app = new JojoApp(page);

  // Check if we're on the setup screen
  const setupCard = page.locator(".setup-card");
  if ((await setupCard.count()) > 0) {
    // We're on setup — tests will handle this.
  }

  return app;
}

/**
 * Wait for the app to reach the main UI (past setup and loading).
 */
export async function waitForMainUI(page: Page): Promise<void> {
  await page.locator(".top-navbar").waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".main-content").waitFor({ state: "visible", timeout: 5000 });
}
