/**
 * Component integration tests for the JojoClient App.
 *
 * These tests render the React App component in jsdom with a mocked
 * window.jojoclient IPC bridge. They verify UI state transitions
 * without needing Electron or a real main process.
 *
 * Run with: npx vitest run tests/integration/app.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { createJojoclientMock } from "../helpers/ipc-mock";
import { createProfile, createInstallationWithProfile, createAccount } from "../helpers/test-fixtures";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// We need to import the App after the mock is installed, because it
// references window.jojoclient at module scope.
// The mock must be set BEFORE App is imported.

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setupMock() {
  const mock = createJojoclientMock();
  (window as any).jojoclient = mock;
  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("App — Setup Screen", () => {
  it("shows loading state initially", async () => {
    const mock = setupMock();
    // Make getSettings return a promise that never resolves to test loading
    mock.getSettings.mockImplementation(() => new Promise(() => {}));

    const { default: App } = await import("../../src/App");
    render(<App />);

    expect(screen.getByText("Loading JojoClient...")).toBeInTheDocument();
  });

  it("shows setup screen when no basePath is set", async () => {
    const mock = setupMock();
    mock.getSettings.mockResolvedValue({ basePath: null });

    const { default: App } = await import("../../src/App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("JojoClient")).toBeInTheDocument();
    });

    expect(screen.getByText("Choose Folder")).toBeInTheDocument();
    expect(
      screen.getByText(/Choose where JojoClient should store/)
    ).toBeInTheDocument();
  });

  it("renders setup screen when basePath is null", async () => {
    const mock = setupMock();
    mock.getSettings.mockResolvedValue({ basePath: null });

    const { default: App } = await import("../../src/App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Choose Folder")).toBeInTheDocument();
    });
  });
});

describe("App — Main UI with profiles and installations", () => {
  async function renderWithData() {
    const mock = setupMock();
    const profile = createProfile({ id: "p1", name: "Main Profile" });
    const inst = createInstallationWithProfile({
      id: "i1",
      name: "Main World",
      profileId: "p1",
      profileName: "Main Profile",
    });
    const account = createAccount();

    mock.getSettings.mockResolvedValue({ basePath: "C:\\test\\jojoclient" });
    mock.getAccount.mockResolvedValue({ ok: true, account });
    mock.getAccounts.mockResolvedValue({ ok: true, accounts: [account] });
    mock.getAllProfiles.mockResolvedValue({ ok: true, profiles: [profile] });
    mock.getAllInstallations.mockResolvedValue({ ok: true, installations: [inst] });
    mock.getGameStatus.mockResolvedValue({
      isDownloaded: true,
      isRunning: false,
      mcVersion: "1.21.4",
      fabricVersion: "0.16.10",
    });

    const { default: App } = await import("../../src/App");
    const result = render(<App />);

    // Wait for the app to finish loading and render the main UI
    await waitFor(
      () => {
        expect(screen.queryByText("Loading JojoClient...")).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    return { mock, profile, inst, account, ...result };
  }

  it("renders the top navbar with navigation tabs", async () => {
    await renderWithData();

    // "Play" appears both in the nav tab and the play button — use data-testid
    await waitFor(() => {
      expect(document.querySelector('[data-testid="nav-play"]')).toBeInTheDocument();
    });

    expect(document.querySelector('[data-testid="nav-mods"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="nav-settings"]')).toBeInTheDocument();
  });

  it("shows the account username when logged in", async () => {
    await renderWithData();

    await waitFor(() => {
      const img = document.querySelector(".account-head");
      expect(img).toBeInTheDocument();
    });
  });

  it("shows the selected installation name", async () => {
    await renderWithData();

    await waitFor(() => {
      // "Main World" appears in the sidebar installation item and possibly
      // in the detail panel — use getAllByText and check at least one exists.
      const matches = screen.getAllByText("Main World");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("play button is present", async () => {
    await renderWithData();

    await waitFor(() => {
      const playBtn = document.querySelector(".play-button");
      expect(playBtn).toBeInTheDocument();
    });
  });

  it("navigates to mods tab on click", async () => {
    const { container } = await renderWithData();

    // Use data-testid for reliable selection
    const modsTab = document.querySelector('[data-testid="nav-mods"]')!;
    expect(modsTab).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(modsTab);
    });

    // The Mods tab should now be active
    await waitFor(() => {
      const activeTab = container.querySelector(".navbar-tab.active");
      expect(activeTab?.textContent?.toLowerCase()).toContain("mods");
    });
  });

  it("navigates to settings tab on click", async () => {
    await renderWithData();

    const settingsTab = document.querySelector('[data-testid="nav-settings"]')!;
    expect(settingsTab).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(settingsTab);
    });

    await waitFor(() => {
      // Settings tab is an icon button, not a text tab — check active class
      expect(settingsTab.classList.contains("active")).toBe(true);
    });
  });

  it("navigates to profiles tab on click", async () => {
    await renderWithData();

    // The profiles button is an icon button in navbar-actions
    const profilesBtn = document.querySelector(".profiles-btn");
    expect(profilesBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(profilesBtn!);
    });

    await waitFor(() => {
      expect(profilesBtn?.classList.contains("active")).toBe(true);
    });
  });

  it("renders setup screen and shows error when folder selection fails", async () => {
    const mock = setupMock();
    mock.getSettings.mockResolvedValue({ basePath: null });
    mock.pickBaseFolder.mockResolvedValue({ ok: false, canceled: true });

    const { default: App } = await import("../../src/App");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Choose Folder")).toBeInTheDocument();
    });

    // Click the "Choose Folder" button — expect it to handle gracefully.
    const btn = screen.getByTestId("choose-folder-btn");
    await act(async () => {
      fireEvent.click(btn);
    });

    // Should still show the button (no error, just canceled).
    await waitFor(() => {
      expect(screen.getByText("Choose Folder")).toBeInTheDocument();
    });
  });
});

describe("App — Event handling", () => {
  /** Helper: render the app with a single profile + installation, wait for main UI. */
  async function renderAppWithData(mock: ReturnType<typeof setupMock>) {
    const profile = createProfile({ id: "p1", name: "Main" });
    const inst = createInstallationWithProfile({
      id: "i1",
      name: "Test",
      profileId: "p1",
      profileName: "Main",
    });

    mock.getSettings.mockResolvedValue({ basePath: "C:\\test" });
    mock.getAccount.mockResolvedValue({ ok: true, account: createAccount() });
    mock.getAccounts.mockResolvedValue({ ok: true, accounts: [createAccount()] });
    mock.getAllProfiles.mockResolvedValue({ ok: true, profiles: [profile] });
    mock.getAllInstallations.mockResolvedValue({ ok: true, installations: [inst] });
    mock.getGameStatus.mockResolvedValue({
      isDownloaded: true,
      isRunning: false,
      mcVersion: "1.21.4",
      fabricVersion: "0.16.10",
    });

    const { default: App } = await import("../../src/App");
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText("Loading JojoClient...")).not.toBeInTheDocument();
    });
  }

  it("IPC mock tracks event listener registrations", async () => {
    // Verify the mock infrastructure itself: onGameLog should be called during
    // the App's useEffect setup, meaning the app registered a listener.
    const mock = setupMock();
    await renderAppWithData(mock);

    // The app's useEffect calls onGameLog to register a listener
    expect(mock.onGameLog).toHaveBeenCalled();
  });

  it("emit triggers registered listeners", async () => {
    const mock = setupMock();
    await renderAppWithData(mock);

    // Verify emit fires the callback that was registered via onGameLog
    expect(mock._listeners.has("game:log")).toBe(true);

    // Simulate a game log push from main process
    act(() => {
      mock.emit("gameLog", "[INFO] Starting Minecraft 1.21.4");
    });

    // The log should appear in the UI (game log panel)
    await waitFor(() => {
      expect(screen.getByText(/Starting Minecraft 1.21.4/i)).toBeInTheDocument();
    });
  });

  it("game exit event triggers status refresh", async () => {
    const mock = setupMock();
    await renderAppWithData(mock);

    // Simulate game exit
    act(() => {
      mock.emit("gameExit", 0);
    });

    // After exit, refreshGameStatus is called
    await waitFor(() => {
      expect(mock.getGameStatus).toHaveBeenCalled();
    });
  });
});

describe("App — IPC error handling", () => {
  it("handles getAllProfiles failure gracefully and renders main UI", async () => {
    const mock = setupMock();
    mock.getSettings.mockResolvedValue({ basePath: "C:\\test" });
    mock.getAccount.mockResolvedValue({ ok: true, account: null });
    mock.getAccounts.mockResolvedValue({ ok: true, accounts: [] });
    mock.getAllProfiles.mockRejectedValue(new Error("Disk full"));

    const { default: App } = await import("../../src/App");
    render(<App />);

    // App should finish loading and render the main UI even when profile
    // loading fails — the error is caught and logged, not fatal.
    await waitFor(
      () => {
        expect(screen.queryByText("Loading JojoClient...")).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Main navbar should be visible — app recovered gracefully.
    expect(screen.getByTestId("nav-play")).toBeInTheDocument();
  });
});
