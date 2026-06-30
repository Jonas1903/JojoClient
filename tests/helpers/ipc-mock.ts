/**
 * Complete mock of window.jojoclient for component and integration testing.
 *
 * Usage:
 *   import { createJojoclientMock } from "../helpers/ipc-mock";
 *   const mock = createJojoclientMock();
 *   window.jojoclient = mock;
 *
 * Every IPC method returns `{ ok: true }` by default. Override per-test:
 *   mock.getSettings.mockResolvedValue({ basePath: "C:\\test" });
 *   mock.getAllProfiles.mockResolvedValue({ ok: true, profiles: [...] });
 *
 * Event listeners are fully functional — call mock.emit("game:log", "line")
 * to simulate main-process events.
 */

import { vi, type Mock } from "vitest";

export interface JojoclientMock {
  // Window controls
  windowMinimize: Mock<() => Promise<void>>;
  windowMaximize: Mock<() => Promise<void>>;
  windowClose: Mock<() => Promise<void>>;
  windowIsMaximized: Mock<() => Promise<boolean>>;

  // Settings
  getSettings: Mock<() => Promise<{ basePath: string | null }>>;
  pickBaseFolder: Mock<() => Promise<{ ok: boolean; path?: string; canceled?: boolean }>>;
  setBaseFolder: Mock<(basePath: string) => Promise<{ ok: boolean; error?: string }>>;

  // Auth
  login: Mock<() => Promise<{ ok: boolean; account?: { username: string; uuid: string }; error?: string }>>;
  logout: Mock<(uuid?: string) => Promise<{ ok: boolean; error?: string }>>;
  getAccount: Mock<() => Promise<{ ok: boolean; account?: { username: string; uuid: string } | null; error?: string }>>;
  getAccounts: Mock<() => Promise<{ ok: boolean; accounts?: { username: string; uuid: string }[]; error?: string }>>;
  setActiveAccount: Mock<(uuid: string) => Promise<{ ok: boolean; error?: string }>>;

  // Game
  getGameStatus: Mock<() => Promise<{ isDownloaded: boolean; isRunning: boolean; mcVersion: string; fabricVersion: string }>>;
  downloadGame: Mock<() => Promise<{ ok: boolean; error?: string }>>;
  launchGame: Mock<(data: { mcVersion: string; fabricVersion: string; installationId: string }) => Promise<{ ok: boolean; error?: string }>>;
  launchQuickGame: Mock<(data: { mcVersion: string }) => Promise<{ ok: boolean; error?: string }>>;
  killGame: Mock<() => Promise<{ ok: boolean }>>;

  // Profiles
  getAllProfiles: Mock<() => Promise<{ ok: boolean; profiles?: any[]; error?: string }>>;
  getProfileByName: Mock<(name: string) => Promise<{ ok: boolean; profile?: any; error?: string }>>;
  createProfile: Mock<(data: { name: string; description?: string }) => Promise<{ ok: boolean; profile?: any; error?: string }>>;
  updateProfile: Mock<(data: { id: string; updates: Record<string, unknown> }) => Promise<{ ok: boolean; profile?: any; error?: string }>>;
  deleteProfile: Mock<(id: string) => Promise<{ ok: boolean; error?: string }>>;
  updateTemplateFromInstallation: Mock<(installationId: string) => Promise<{ ok: boolean; synced?: boolean; error?: string }>>;
  exportProfileSettingsBundle: Mock<(profileId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>;
  importProfileSettingsBundle: Mock<(data: { profileId: string; bundle: string }) => Promise<{ ok: boolean; error?: string }>>;
  exportProfileFile: Mock<(profileId: string) => Promise<{ ok: boolean; exportDir?: string; canceled?: boolean; error?: string }>>;
  exportProfileCode: Mock<(profileId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>;
  importProfileFile: Mock<() => Promise<{ ok: boolean; profileId?: string; profileName?: string; canceled?: boolean; error?: string }>>;
  loadProfileBundleFromFile: Mock<() => Promise<{ ok: boolean; bundle?: string; canceled?: boolean; error?: string }>>;
  importProfileFromCode: Mock<(bundle: string) => Promise<{ ok: boolean; profileId?: string; profileName?: string; error?: string }>>;

  // Installations
  getAllInstallations: Mock<() => Promise<{ ok: boolean; installations?: any[]; error?: string }>>;
  getInstallationsByProfile: Mock<(profileName: string) => Promise<{ ok: boolean; installations?: any[]; error?: string }>>;
  getInstallationById: Mock<(id: string) => Promise<{ ok: boolean; installation?: any; error?: string }>>;
  createInstallation: Mock<(data: { profileId: string; name: string; minecraftVersion?: string; description?: string }) => Promise<{ ok: boolean; installation?: any; error?: string }>>;
  updateInstallation: Mock<(data: { id: string; updates: Record<string, unknown> }) => Promise<{ ok: boolean; installation?: any; error?: string }>>;
  deleteInstallation: Mock<(id: string) => Promise<{ ok: boolean; error?: string }>>;
  moveInstallation: Mock<(data: { installationId: string; targetProfileId: string }) => Promise<{ ok: boolean; installation?: any; error?: string }>>;
  getInstallationGameDir: Mock<(installationId: string) => Promise<{ ok: boolean; gameDir?: string; error?: string }>>;
  syncInstallationFromTemplate: Mock<(installationId: string) => Promise<{ ok: boolean; synced?: boolean; error?: string }>>;

  // Export/Import
  exportProfile: Mock<(profileId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>;
  exportInstallation: Mock<(installationId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>;
  saveExportToFile: Mock<(data: { bundle: string; defaultName: string }) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>>;
  loadImportFromFile: Mock<() => Promise<{ ok: boolean; bundle?: string; metadata?: any; type?: string; canceled?: boolean; error?: string }>>;
  importProfile: Mock<(data: { bundle: string; newName?: string }) => Promise<{ ok: boolean; profile?: any; error?: string }>>;
  importInstallation: Mock<(data: { bundle: string; targetProfileId: string; newName?: string }) => Promise<{ ok: boolean; installation?: any; error?: string }>>;

  // Mods
  downloadMod: Mock<(data: any) => Promise<{ ok: boolean; file?: any; error?: string }>>;
  addProfileMod: Mock<(data: { profileId: string; slug: string; title?: string; iconUrl?: string | null }) => Promise<{ ok: boolean; error?: string }>>;
  listProfileMods: Mock<(profileId: string) => Promise<{ ok: boolean; mods?: any[]; error?: string }>>;
  setProfileModEnabled: Mock<(data: { profileId: string; slug: string; enabled: boolean }) => Promise<{ ok: boolean; error?: string }>>;
  listInstallationMods: Mock<(installationId: string) => Promise<{ ok: boolean; mods?: any[]; error?: string }>>;
  deleteMod: Mock<(data: any) => Promise<{ ok: boolean; error?: string }>>;
  exportProfileMods: Mock<(data: { profileId: string; slugs?: string[] }) => Promise<{ ok: boolean; bundle?: string; error?: string }>>;
  importProfileMods: Mock<(data: { profileId: string; bundle: string }) => Promise<{ ok: boolean; error?: string }>>;
  loadModsBundleFromFile: Mock<() => Promise<{ ok: boolean; bundle?: string; canceled?: boolean; error?: string }>>;
  syncProfileModsToInstallations: Mock<(profileId: string) => Promise<{ ok: boolean; syncedCount?: number; results?: any[]; error?: string }>>;
  syncInstallationMods: Mock<(installationId: string) => Promise<{ ok: boolean; failed?: string[]; issues?: any[]; error?: string }>>;

  // Utilities
  getLatestFabricForVersion: Mock<(mcVersion: string) => Promise<{ ok: boolean; fabricVersion?: string; error?: string }>>;

  // Shell
  openFolder: Mock<(folderPath: string) => Promise<{ ok: boolean; error?: string }>>;

  // Auto-updater
  getAppVersion: Mock<() => Promise<string>>;
  checkForUpdates: Mock<() => Promise<{ ok: boolean; error?: string }>>;
  downloadUpdate: Mock<() => Promise<{ ok: boolean; error?: string }>>;
  installUpdate: Mock<() => Promise<{ ok: boolean }>>;

  // Event emitters (return unsubscribe functions)
  onDownloadProgress: Mock<(cb: (progress: unknown) => void) => () => void>;
  onGameLog: Mock<(cb: (line: string) => void) => () => void>;
  onGameExit: Mock<(cb: (code: number | null) => void) => () => void>;
  onModsDownloadProgress: Mock<(cb: (progress: unknown) => void) => () => void>;
  onInstanceProgress: Mock<(cb: (progress: any) => void) => () => void>;
  onMainMessage: Mock<(cb: (message: string) => void) => () => void>;
  onUpdateAvailable: Mock<(cb: (info: any) => void) => () => void>;
  onUpdateNotAvailable: Mock<(cb: () => void) => () => void>;
  onUpdateDownloadProgress: Mock<(cb: (progress: any) => void) => () => void>;
  onUpdateDownloaded: Mock<(cb: () => void) => () => void>;
  onUpdateError: Mock<(cb: (error: string) => void) => () => void>;

  // Internal: active event listeners (for simulating main-process pushes)
  _listeners: Map<string, Set<(...args: any[]) => void>>;

  /** Simulate a main-process event push (e.g. mock.emit("game:log", "[INFO] Hello")) */
  emit: (channel: string, ...args: any[]) => void;

  /** Reset all mock calls and event listeners */
  reset: () => void;
}

const CHANNEL_MAP: Record<string, string> = {
  downloadProgress: "game:downloadProgress",
  gameLog: "game:log",
  gameExit: "game:exit",
  modsDownloadProgress: "mods:downloadProgress",
  instanceProgress: "instance:progress",
  mainMessage: "main-process-message",
  updateAvailable: "app:update-available",
  updateNotAvailable: "app:update-not-available",
  updateDownloadProgress: "app:update-download-progress",
  updateDownloaded: "app:update-downloaded",
  updateError: "app:update-error",
};

function makeOkMock<TReturn>(defaultValue: TReturn): Mock<() => Promise<TReturn>> {
  const fn = vi.fn<() => Promise<TReturn>>();
  fn.mockResolvedValue(defaultValue as Awaited<TReturn>);
  return fn as unknown as Mock<() => Promise<TReturn>>;
}

function makeEventMock(channel: string, listeners: Map<string, Set<(...args: any[]) => void>>): Mock<(cb: (...args: any[]) => void) => () => void> {
  return vi.fn((cb: (...args: any[]) => void) => {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }
    listeners.get(channel)!.add(cb);
    return () => {
      listeners.get(channel)?.delete(cb);
    };
  }) as unknown as Mock<(cb: (...args: any[]) => void) => () => void>;
}

export function createJojoclientMock(): JojoclientMock {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();

  const emit = (eventName: string, ...args: any[]) => {
    const channel = CHANNEL_MAP[eventName] ?? eventName;
    const fns = listeners.get(channel);
    if (fns) {
      for (const fn of fns) {
        try { fn(...args); } catch { /* swallow listener errors */ }
      }
    }
  };

  const mock: JojoclientMock = {
    // Window
    windowMinimize: makeOkMock<void>(undefined),
    windowMaximize: makeOkMock<void>(undefined),
    windowClose: makeOkMock<void>(undefined),
    windowIsMaximized: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),

    // Settings
    getSettings: vi.fn<() => Promise<{ basePath: string | null }>>().mockResolvedValue({ basePath: "C:\\test\\jojoclient" }),
    pickBaseFolder: vi.fn<() => Promise<{ ok: boolean; path?: string; canceled?: boolean }>>().mockResolvedValue({ ok: true, path: "C:\\test\\jojoclient" }),
    setBaseFolder: vi.fn<(basePath: string) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),

    // Auth
    login: vi.fn<() => Promise<{ ok: boolean; account?: { username: string; uuid: string }; error?: string }>>().mockResolvedValue({
      ok: true,
      account: { username: "TestPlayer", uuid: "test-uuid-1234" },
    }),
    logout: vi.fn<(uuid?: string) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    getAccount: vi.fn<() => Promise<{ ok: boolean; account?: { username: string; uuid: string } | null; error?: string }>>().mockResolvedValue({
      ok: true,
      account: { username: "TestPlayer", uuid: "test-uuid-1234" },
    }),
    getAccounts: vi.fn<() => Promise<{ ok: boolean; accounts?: { username: string; uuid: string }[]; error?: string }>>().mockResolvedValue({
      ok: true,
      accounts: [{ username: "TestPlayer", uuid: "test-uuid-1234" }],
    }),
    setActiveAccount: vi.fn<(uuid: string) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),

    // Game
    getGameStatus: vi.fn<() => Promise<{ isDownloaded: boolean; isRunning: boolean; mcVersion: string; fabricVersion: string }>>().mockResolvedValue({
      isDownloaded: true,
      isRunning: false,
      mcVersion: "1.21.4",
      fabricVersion: "0.16.10",
    }),
    downloadGame: vi.fn<() => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    launchGame: vi.fn<(data: { mcVersion: string; fabricVersion: string; installationId: string }) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    launchQuickGame: vi.fn<(data: { mcVersion: string }) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    killGame: vi.fn<() => Promise<{ ok: boolean }>>().mockResolvedValue({ ok: true }),

    // Profiles
    getAllProfiles: vi.fn<() => Promise<{ ok: boolean; profiles?: any[]; error?: string }>>().mockResolvedValue({ ok: true, profiles: [] }),
    getProfileByName: vi.fn<(name: string) => Promise<{ ok: boolean; profile?: any; error?: string }>>().mockResolvedValue({ ok: true, profile: null }),
    createProfile: vi.fn<(data: { name: string; description?: string }) => Promise<{ ok: boolean; profile?: any; error?: string }>>().mockResolvedValue({ ok: true, profile: null }),
    updateProfile: vi.fn<(data: { id: string; updates: Record<string, unknown> }) => Promise<{ ok: boolean; profile?: any; error?: string }>>().mockResolvedValue({ ok: true }),
    deleteProfile: vi.fn<(id: string) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    updateTemplateFromInstallation: vi.fn<(installationId: string) => Promise<{ ok: boolean; synced?: boolean; error?: string }>>().mockResolvedValue({ ok: true, synced: true }),
    exportProfileSettingsBundle: vi.fn<(profileId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>().mockResolvedValue({ ok: true, bundle: "{}" }),
    importProfileSettingsBundle: vi.fn<(data: { profileId: string; bundle: string }) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    exportProfileFile: vi.fn<(profileId: string) => Promise<{ ok: boolean; exportDir?: string; canceled?: boolean; error?: string }>>().mockResolvedValue({ ok: true, exportDir: "C:\\test\\export" }),
    exportProfileCode: vi.fn<(profileId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>().mockResolvedValue({ ok: true, bundle: "{}" }),
    importProfileFile: vi.fn<() => Promise<{ ok: boolean; profileId?: string; profileName?: string; canceled?: boolean; error?: string }>>().mockResolvedValue({ ok: true, profileId: "new-id", profileName: "Imported" }),
    loadProfileBundleFromFile: vi.fn<() => Promise<{ ok: boolean; bundle?: string; canceled?: boolean; error?: string }>>().mockResolvedValue({ ok: true, bundle: "{}" }),
    importProfileFromCode: vi.fn<(bundle: string) => Promise<{ ok: boolean; profileId?: string; profileName?: string; error?: string }>>().mockResolvedValue({ ok: true, profileId: "new-id", profileName: "Imported" }),

    // Installations
    getAllInstallations: vi.fn<() => Promise<{ ok: boolean; installations?: any[]; error?: string }>>().mockResolvedValue({ ok: true, installations: [] }),
    getInstallationsByProfile: vi.fn<(profileName: string) => Promise<{ ok: boolean; installations?: any[]; error?: string }>>().mockResolvedValue({ ok: true, installations: [] }),
    getInstallationById: vi.fn<(id: string) => Promise<{ ok: boolean; installation?: any; error?: string }>>().mockResolvedValue({ ok: true, installation: null }),
    createInstallation: vi.fn<(data: any) => Promise<{ ok: boolean; installation?: any; error?: string }>>().mockResolvedValue({ ok: true, installation: null }),
    updateInstallation: vi.fn<(data: { id: string; updates: Record<string, unknown> }) => Promise<{ ok: boolean; installation?: any; error?: string }>>().mockResolvedValue({ ok: true }),
    deleteInstallation: vi.fn<(id: string) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    moveInstallation: vi.fn<(data: { installationId: string; targetProfileId: string }) => Promise<{ ok: boolean; installation?: any; error?: string }>>().mockResolvedValue({ ok: true }),
    getInstallationGameDir: vi.fn<(installationId: string) => Promise<{ ok: boolean; gameDir?: string; error?: string }>>().mockResolvedValue({ ok: true, gameDir: "C:\\test\\game" }),
    syncInstallationFromTemplate: vi.fn<(installationId: string) => Promise<{ ok: boolean; synced?: boolean; error?: string }>>().mockResolvedValue({ ok: true, synced: true }),

    // Export/Import
    exportProfile: vi.fn<(profileId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>().mockResolvedValue({ ok: true, bundle: "" }),
    exportInstallation: vi.fn<(installationId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>>().mockResolvedValue({ ok: true, bundle: "" }),
    saveExportToFile: vi.fn<(data: any) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>>().mockResolvedValue({ ok: true, filePath: "C:\\test\\export.jojo" }),
    loadImportFromFile: vi.fn<() => Promise<{ ok: boolean; bundle?: string; metadata?: any; type?: string; canceled?: boolean; error?: string }>>().mockResolvedValue({ ok: true, bundle: "", type: "profile" }),
    importProfile: vi.fn<(data: any) => Promise<{ ok: boolean; profile?: any; error?: string }>>().mockResolvedValue({ ok: true, profile: null }),
    importInstallation: vi.fn<(data: any) => Promise<{ ok: boolean; installation?: any; error?: string }>>().mockResolvedValue({ ok: true, installation: null }),

    // Mods
    downloadMod: vi.fn<(data: any) => Promise<{ ok: boolean; file?: any; error?: string }>>().mockResolvedValue({ ok: true }),
    addProfileMod: vi.fn<(data: any) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    listProfileMods: vi.fn<(profileId: string) => Promise<{ ok: boolean; mods?: any[]; error?: string }>>().mockResolvedValue({ ok: true, mods: [] }),
    setProfileModEnabled: vi.fn<(data: any) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    listInstallationMods: vi.fn<(installationId: string) => Promise<{ ok: boolean; mods?: any[]; error?: string }>>().mockResolvedValue({ ok: true, mods: [] }),
    deleteMod: vi.fn<(data: any) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    exportProfileMods: vi.fn<(data: any) => Promise<{ ok: boolean; bundle?: string; error?: string }>>().mockResolvedValue({ ok: true, bundle: "" }),
    importProfileMods: vi.fn<(data: any) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    loadModsBundleFromFile: vi.fn<() => Promise<{ ok: boolean; bundle?: string; canceled?: boolean; error?: string }>>().mockResolvedValue({ ok: true, bundle: "" }),
    syncProfileModsToInstallations: vi.fn<(profileId: string) => Promise<{ ok: boolean; syncedCount?: number; results?: any[]; error?: string }>>().mockResolvedValue({ ok: true, syncedCount: 0, results: [] }),
    syncInstallationMods: vi.fn<(installationId: string) => Promise<{ ok: boolean; failed?: string[]; issues?: any[]; error?: string }>>().mockResolvedValue({ ok: true, failed: [], issues: [] }),

    // Utilities
    getLatestFabricForVersion: vi.fn<(mcVersion: string) => Promise<{ ok: boolean; fabricVersion?: string; error?: string }>>().mockResolvedValue({ ok: true, fabricVersion: "0.16.10" }),

    // Shell
    openFolder: vi.fn<(folderPath: string) => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),

    // Auto-updater
    getAppVersion: vi.fn<() => Promise<string>>().mockResolvedValue("1.2.7"),
    checkForUpdates: vi.fn<() => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    downloadUpdate: vi.fn<() => Promise<{ ok: boolean; error?: string }>>().mockResolvedValue({ ok: true }),
    installUpdate: vi.fn<() => Promise<{ ok: boolean }>>().mockResolvedValue({ ok: true }),

    // Events
    onDownloadProgress: makeEventMock("game:downloadProgress", listeners),
    onGameLog: makeEventMock("game:log", listeners),
    onGameExit: makeEventMock("game:exit", listeners),
    onModsDownloadProgress: makeEventMock("mods:downloadProgress", listeners),
    onInstanceProgress: makeEventMock("instance:progress", listeners),
    onMainMessage: makeEventMock("main-process-message", listeners),
    onUpdateAvailable: makeEventMock("app:update-available", listeners),
    onUpdateNotAvailable: makeEventMock("app:update-not-available", listeners),
    onUpdateDownloadProgress: makeEventMock("app:update-download-progress", listeners),
    onUpdateDownloaded: makeEventMock("app:update-downloaded", listeners),
    onUpdateError: makeEventMock("app:update-error", listeners),

    _listeners: listeners,
    emit,

    reset() {
      for (const key of Object.keys(mock)) {
        const val = (mock as any)[key];
        if (typeof val === "function" && "mockClear" in val) {
          val.mockClear();
        }
      }
      listeners.clear();
    },
  };

  return mock;
}

/**
 * Apply the mock to window.jojoclient. In Vitest with jsdom,
 * you must also declare the type globally.
 *
 * Usage in a test:
 *   const mock = installJojoclientMock();
 *   mock.getAllProfiles.mockResolvedValue({ ok: true, profiles: [testProfile] });
 */
export function installJojoclientMock(): JojoclientMock {
  const mock = createJojoclientMock();
  (window as any).jojoclient = mock;
  return mock;
}
