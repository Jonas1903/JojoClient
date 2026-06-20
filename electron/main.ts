import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { readSettings, writeSettings } from "../src/main/utils/storage";
import { ensureBaseFolder, getBasePath } from "../src/main/utils/baseFolder";
import { login, logout, getAccount, getAccounts, setActiveAccount } from "../src/main/services/auth";
import { getAuthStateManager, initializeAuthState } from "../src/main/services/authStateManager";
import {
  DEFAULT_MC_VERSION,
  DEFAULT_FABRIC_LOADER_VERSION,
  getLatestFabricLoaderForMcVersion,
} from "../src/main/services/versions";
import { downloadGame, isVersionDownloaded, DownloadProgress } from "../src/main/services/download";
import { launchGame, isGameRunning, killGame, LaunchOptions, GameProcess } from "../src/main/services/launcher";
import { DownloadResult } from "../src/main/services/download";
import * as profiles from "../src/main/services/profiles";
import * as mods from "../src/main/services/mods";
import * as exportImport from "../src/main/services/exportImport";
import {
  PROFILE_EXPORT_FORMAT,
  CURRENT_PROFILE_SCHEMA_VERSION,
  ProfileExportEnvelope,
} from "../src/main/services/profileExportSchema";
import {
  buildProfileExport,
  collectTemplateFiles,
  collectProfileFiles,
  applyTemplateFiles,
  applyProfileFiles,
  deserializeProfile,
  migrateProfileExport,
  persistImportedProfile,
  resolveProfileConflicts,
  exportProfileToFolder,
  importProfileFromFolder,
  validateProfileFolder,
} from "../src/main/services/profileSerializer";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Prevent GPU-related black screen issues on some Windows setups.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

console.log("✅ MAIN STARTED (electron/main.ts)");
console.log("✅ JojoClient MAIN loaded");

// CommonJS: __dirname is available directly
// The built directory structure:
// dist-electron/electron/main.js  <-- we are here
// dist-electron/electron/preload.js
// dist-electron/src/main/storage.js
// So __dirname = dist-electron/electron, go up 2 levels to project root
const isDev = !!process.env["VITE_DEV_SERVER_URL"];
process.env.APP_ROOT = isDev
  ? path.join(__dirname, "..", "..")
  : path.join(__dirname, "..", "..");  // In production, asar root

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;
let zoomUpdateTimer: ReturnType<typeof setTimeout> | null = null;
// Maps installation ID → all currently running game processes for that installation.
// Multiple concurrent instances of the same installation are explicitly supported.
const gameProcesses = new Map<string, GameProcess[]>();
// Serializes the file-sync phase (template settings + mods) per installation.
// Prevents concurrent reads/writes from corrupting the template when the same
// installation is launched rapidly before a previous sync has completed.
const installationSyncChain = new Map<string, Promise<void>>();

const BASE_UI_WIDTH = 1280;
const BASE_UI_HEIGHT = 800;
const MIN_UI_ZOOM = 0.9;
const MAX_UI_ZOOM = 1.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applyAdaptiveZoom(target: BrowserWindow): void {
  const [contentWidth, contentHeight] = target.getContentSize();
  const widthScale = contentWidth / BASE_UI_WIDTH;
  const heightScale = contentHeight / BASE_UI_HEIGHT;
  const zoomFactor = clamp(Math.min(widthScale, heightScale), MIN_UI_ZOOM, MAX_UI_ZOOM);
  target.webContents.setZoomFactor(Number(zoomFactor.toFixed(3)));
}

function scheduleAdaptiveZoom(target: BrowserWindow): void {
  if (zoomUpdateTimer) {
    clearTimeout(zoomUpdateTimer);
  }

  // Small debounce keeps resize drags smooth and avoids excessive zoom writes.
  zoomUpdateTimer = setTimeout(() => {
    if (target.isDestroyed()) return;
    applyAdaptiveZoom(target);
  }, 16);
}

/**
 * Chains `fn` onto any in-progress sync for this installation so that
 * file operations are always sequential, while still allowing multiple
 * independent instances to eventually spawn in parallel.
 */
function runWithInstallationSyncLock(
  installationId: string,
  fn: () => Promise<void>
): Promise<void> {
  const tail = installationSyncChain.get(installationId) ?? Promise.resolve();
  // Build chain synchronously (no await) so concurrent callers stack correctly.
  const next = tail.catch(() => {}).then(() => fn());
  // Store a silenced version as the new tail so subsequent callers aren't
  // blocked by errors from this invocation.
  installationSyncChain.set(installationId, next.catch(() => {}));
  return next; // Return original to propagate our own errors to the caller.
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim();
}

function validateProfileExportEnvelope(data: unknown): ProfileExportEnvelope {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid export file.");
  }
  const obj = data as Record<string, unknown>;
  if (obj.format !== PROFILE_EXPORT_FORMAT) {
    throw new Error("Invalid export format.");
  }
  if (typeof obj.schemaVersion !== "number" || obj.schemaVersion < 1) {
    throw new Error("Unsupported schema version.");
  }
  if (!obj.profile || typeof obj.profile !== "object") {
    throw new Error("Export file missing profile data.");
  }
  return obj as ProfileExportEnvelope;
}

function buildProfileExportBundle(rawProfile: unknown): { exportData: ProfileExportEnvelope; serialized: string } {
  const profileName = String((rawProfile as { name?: string }).name || "");
  const templateDir = profiles.getProfileTemplateDir(profileName);
  const profileDir = profiles.getProfileDir(profileName);
  const installationsDir = profiles.getInstallationsDir(profileName);
  const templateFiles = collectTemplateFiles(templateDir);
  const profileFiles = collectProfileFiles(profileDir, templateDir, installationsDir);

  const exportData = buildProfileExport(
    rawProfile as Record<string, unknown>,
    templateFiles,
    profileFiles
  );
  const serialized = JSON.stringify(exportData, null, 2);
  return { exportData, serialized };
}

async function importProfileFromBundle(raw: string): Promise<{ ok: true; profileId: string; profileName: string; profileFilesCount: number; templateFilesCount: number; hasModsJson: boolean } | { ok: false; error: string }> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const envelope = validateProfileExportEnvelope(parsed);

    if (envelope.schemaVersion > CURRENT_PROFILE_SCHEMA_VERSION) {
      return { ok: false, error: "Profile export schema is newer than this launcher version." };
    }

    const migrated = migrateProfileExport(envelope);
    const profileData = deserializeProfile(migrated.profile);
    const index = await profiles.loadProfilesIndex();
    const resolved = resolveProfileConflicts(profileData, index);
    const profileId = await persistImportedProfile(resolved);

    const profileName = String(resolved.name || "");
    const profileDir = profiles.getProfileDir(profileName);
    const profileFilesCount = (migrated.profileFiles ?? []).length;
    const templateFilesCount = (migrated.templateFiles ?? []).length;
    const hasModsJson = (migrated.profileFiles ?? []).some((file) => file.path === "mods.json");

    applyProfileFiles(profileDir, migrated.profileFiles ?? []);
    const templateDir = profiles.getProfileTemplateDir(profileName);
    applyTemplateFiles(templateDir, migrated.templateFiles ?? []);

    return { ok: true, profileId, profileName: String(resolved.name || ""), profileFilesCount, templateFilesCount, hasModsJson };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function createWindow() {
  const settings = readSettings();
  const bounds = settings.windowBounds;

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, "icon.svg"),
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(process.env.APP_ROOT!, "dist-electron", "electron", "preload.js"),
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Remove menu bar entirely
  win.setMenu(null);

  if (bounds?.isMaximized) {
    win.maximize();
  }

  win.webContents.on("did-finish-load", () => {
    if (!win) return;
    applyAdaptiveZoom(win);
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[RENDERER:${level}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Renderer failed to load:", { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
  });

  // Debug: Log paths in production to help diagnose white screen
  console.log("APP_ROOT:", process.env.APP_ROOT);
  console.log("RENDERER_DIST:", RENDERER_DIST);
  console.log("VITE_DEV_SERVER_URL:", VITE_DEV_SERVER_URL);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(RENDERER_DIST, "index.html");
    console.log("Loading index.html from:", indexPath);
    console.log("File exists:", fs.existsSync(indexPath));
    win.loadFile(indexPath);
  }

  const saveWindowBounds = () => {
    if (!win) return;
    const current = readSettings();
    const isMaximized = win.isMaximized();
    const winBounds = win.getBounds();
    writeSettings({
      ...current,
      windowBounds: {
        width: winBounds.width,
        height: winBounds.height,
        x: winBounds.x,
        y: winBounds.y,
        isMaximized,
      },
    });
  };

  win.on("close", saveWindowBounds);
  win.on("resize", saveWindowBounds);
  win.on("move", saveWindowBounds);

  win.on("resize", () => {
    if (!win) return;
    scheduleAdaptiveZoom(win);
  });

  win.on("maximize", () => {
    if (!win) return;
    scheduleAdaptiveZoom(win);
  });

  win.on("unmaximize", () => {
    if (!win) return;
    scheduleAdaptiveZoom(win);
  });

  win.on("enter-full-screen", () => {
    if (!win) return;
    scheduleAdaptiveZoom(win);
  });

  win.on("leave-full-screen", () => {
    if (!win) return;
    scheduleAdaptiveZoom(win);
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  // Prevent double-registration (dev rebuilds can cause weirdness)
  ipcMain.removeHandler("settings:get");
  ipcMain.removeHandler("baseFolder:pick");
  ipcMain.removeHandler("baseFolder:set");
  ipcMain.removeHandler("auth:login");
  ipcMain.removeHandler("auth:logout");
  ipcMain.removeHandler("auth:getAccount");
  ipcMain.removeHandler("auth:getAccounts");
  ipcMain.removeHandler("auth:setActive");
  ipcMain.removeHandler("window:minimize");
  ipcMain.removeHandler("window:maximize");
  ipcMain.removeHandler("window:close");
  ipcMain.removeHandler("window:isMaximized");

  console.log("✅ MAIN whenReady: registering IPC handlers");

  // Auto-updater setup (only in production)
  if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info) => {
      console.log("📦 Update available:", info.version);
    });

    autoUpdater.on("update-not-available", () => {
      console.log("✅ App is up to date");
    });

    autoUpdater.on("download-progress", (progress) => {
      console.log(`⬇️ Downloading update: ${Math.floor(progress.percent)}%`);
    });

    autoUpdater.on("update-downloaded", () => {
      console.log("✅ Update downloaded — will install silently on next app close");
    });

    autoUpdater.on("error", (error) => {
      console.error("❌ Update error:", error);
    });

    // Check for updates on startup (after 3 seconds)
    setTimeout(() => {
      console.log("🔍 Checking for updates...");
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("Failed to check for updates:", err);
      });
    }, 3000);
  }

  // Window control handlers
  ipcMain.handle("window:minimize", () => {
    win?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle("window:close", () => {
    win?.close();
  });

  ipcMain.handle("window:isMaximized", () => {
    return win?.isMaximized() ?? false;
  });

  ipcMain.handle("settings:get", () => {
    console.log("✅ IPC settings:get called");
    return readSettings();
  });

  ipcMain.handle("baseFolder:pick", async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose JojoClient Storage Folder",
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("baseFolder:set", async (_event, basePath: string) => {
    try {
      ensureBaseFolder(basePath);
      const current = readSettings();
      writeSettings({ ...current, basePath });
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg || "Failed to initialize folder" };
    }
  });

  // Initialize auth state manager
  initializeAuthState().catch((err) => {
    console.error("❌ Failed to initialize auth state:", err);
  });

  // Auth handlers with state management
  ipcMain.handle("auth:login", async () => {
    try {
      const account = await login();
      const authManager = getAuthStateManager();
      authManager.updateAccount(account);
      return { ok: true, account };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("❌ Login failed:", msg);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("auth:logout", async (_event, uuid?: string) => {
    try {
      logout(uuid);
      const authManager = getAuthStateManager();
      authManager.updateAccount(null);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("auth:getAccounts", () => {
    try {
      const accounts = getAccounts();
      return { ok: true, accounts };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("auth:setActive", async (_event, uuid: string) => {
    try {
      setActiveAccount(uuid);
      const account = await getAccount();
      const authManager = getAuthStateManager();
      authManager.updateAccount(account);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("auth:getAccount", async () => {
    try {
      const authManager = getAuthStateManager();
      const account = await authManager.forceRefresh();
      return { ok: true, account };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  // ========================================
  // Shell handlers
  // ========================================

  ipcMain.handle("shell:openFolder", async (_event, folderPath: string) => {
    try {
      await shell.openPath(folderPath);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  // Game launch handlers
  let cachedDownloadResult: DownloadResult | null = null;

  ipcMain.handle("game:getStatus", () => {
    return {
      isDownloaded: isVersionDownloaded(DEFAULT_MC_VERSION, DEFAULT_FABRIC_LOADER_VERSION),
      isRunning: isGameRunning(),
      mcVersion: DEFAULT_MC_VERSION,
      fabricVersion: DEFAULT_FABRIC_LOADER_VERSION,
    };
  });

  ipcMain.handle("game:download", async (event) => {
    try {
      const result = await downloadGame(
        DEFAULT_MC_VERSION,
        DEFAULT_FABRIC_LOADER_VERSION,
        (progress: DownloadProgress) => {
          // Send progress to renderer
          event.sender.send("game:downloadProgress", progress);
        }
      );
      cachedDownloadResult = result;
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("❌ Download failed:", msg);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("game:launch", async (event, data: { mcVersion: string; fabricVersion: string; installationId: string }) => {
    try {
      const mcVersion = data?.mcVersion || DEFAULT_MC_VERSION;

      const installation = await profiles.getInstallationById(data.installationId);
      if (!installation) {
        return { ok: false, error: "Installation not found" };
      }

      const fabricVersion = data?.fabricVersion || installation.fabricLoaderVersion || DEFAULT_FABRIC_LOADER_VERSION;
      const gameDir = profiles.getInstallationDir(
        profiles.sanitizeName(installation.profileName),
        profiles.sanitizeName(installation.name)
      );

      const MAX_AUTO_RECOVERY_ATTEMPTS = 2;
      const STARTUP_CRASH_WINDOW_MS = 90_000;

      const registerProcess = (proc: GameProcess) => {
        const existingProcs = gameProcesses.get(installation.id) ?? [];
        existingProcs.push(proc);
        gameProcesses.set(installation.id, existingProcs);
      };

      const unregisterProcess = (proc: GameProcess) => {
        const procs = gameProcesses.get(installation.id);
        if (!procs) return;
        const idx = procs.indexOf(proc);
        if (idx !== -1) procs.splice(idx, 1);
        if (procs.length === 0) gameProcesses.delete(installation.id);
      };

      const persistSyncIssues = async (syncResult: { issues: unknown[]; skipped?: true }) => {
        if (syncResult.skipped) return;
        if (syncResult.issues.length > 0) {
          await profiles.updateInstallation(installation.id, { modIssues: syncResult.issues } as any);
        } else {
          await profiles.updateInstallation(installation.id, { modIssues: [] } as any);
        }

        // Emit a post-persist "done" to let the renderer reload authoritative
        // installation issue state after disk writes complete.
        event.sender.send("mods:downloadProgress", {
          installationId: installation.id,
          phase: "done",
          current: 0,
          total: 0,
        });
      };

      const runPreLaunchSync = async (): Promise<string | null> => {
        let syncError: string | null = null;
        await runWithInstallationSyncLock(installation.id, async () => {
          try {
            await profiles.syncTemplateSettingsToInstallation(installation.id);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn("⚠️ Settings sync skipped:", msg);
          }
          try {
            const syncResult = await mods.syncProfileModsToInstallation(
              installation.profileId,
              installation.id,
              (progress) => {
                event.sender.send("mods:downloadProgress", {
                  installationId: installation.id,
                  ...progress,
                });
              }
            );

            await persistSyncIssues(syncResult);
          } catch (e) {
            syncError = e instanceof Error ? e.message : String(e);
          }
        });
        return syncError;
      };

      const runCrashRecoverySync = async (): Promise<{ error: string | null; recovered: boolean }> => {
        let syncError: string | null = null;
        let recovered = false;

        await runWithInstallationSyncLock(installation.id, async () => {
          try {
            const syncResult = await mods.syncProfileModsToInstallation(
              installation.profileId,
              installation.id,
              (progress) => {
                event.sender.send("mods:downloadProgress", {
                  installationId: installation.id,
                  ...progress,
                });
              }
            );

            recovered = syncResult.issues.some((issue) =>
              issue.error.includes("Recovered from startup crash")
            );

            await persistSyncIssues(syncResult);
          } catch (e) {
            syncError = e instanceof Error ? e.message : String(e);
          }
        });

        return { error: syncError, recovered };
      };

      const modSyncError = await runPreLaunchSync();
      if (modSyncError) {
        console.error("❌ Mod sync before launch failed:", modSyncError);
        return { ok: false, error: modSyncError };
      }

      const downloadResult = await downloadGame(
        mcVersion,
        fabricVersion,
        (progress: DownloadProgress) => {
          event.sender.send("game:downloadProgress", progress);
        }
      );

      const options: LaunchOptions = {
        downloadResult,
        gameDir,
      };

      const launchAttempt = async (attempt: number): Promise<GameProcess> => {
        const launchedAt = Date.now();
        let currentProcess!: GameProcess;

        currentProcess = await launchGame(
          options,
          (line: string) => {
            event.sender.send("game:log", line);
          },
          async (code: number | null) => {
            unregisterProcess(currentProcess);

            try {
              await mods.processPendingSyncs();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error("❌ Pending sync failed:", msg);
            }

            const startupCrash =
              code !== null &&
              code !== 0 &&
              Date.now() - launchedAt <= STARTUP_CRASH_WINDOW_MS;

            if (startupCrash && attempt < MAX_AUTO_RECOVERY_ATTEMPTS) {
              const recovery = await runCrashRecoverySync();
              if (recovery.error) {
                console.error("❌ Crash recovery sync failed:", recovery.error);
                event.sender.send("game:exit", code);
                return;
              }

              if (recovery.recovered) {
                const nextAttempt = attempt + 1;
                const totalAttempts = MAX_AUTO_RECOVERY_ATTEMPTS + 1;
                event.sender.send(
                  "game:log",
                  `[INFO] Startup crash recovered. Relaunching automatically (${nextAttempt + 1}/${totalAttempts})...`
                );

                try {
                  const relaunched = await launchAttempt(nextAttempt);
                  registerProcess(relaunched);
                  return;
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error("❌ Auto-relaunch failed:", msg);
                  event.sender.send("game:exit", code);
                  return;
                }
              }
            }

            // Only persist installation settings back to template on clean exit.
            if (code === 0) {
              try {
                await runWithInstallationSyncLock(installation.id, async () => {
                  const syncResult = await profiles.updateTemplateSettingsFromInstallation(installation.id);
                  if (syncResult.versionMismatch) {
                    console.log(`⚠️ Config not synced due to version mismatch: ${syncResult.reason}`);
                  }
                });
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error("❌ Settings sync from installation failed:", msg);
              }
            }

            event.sender.send("game:exit", code);
          },
          (jp) => {
            event.sender.send("game:downloadProgress", jp);
          }
        );

        return currentProcess;
      };

      const gameProcess = await launchAttempt(0);
      registerProcess(gameProcess);

      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("❌ Launch failed:", msg);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("game:launchQuick", async (event, data: { mcVersion: string }) => {
    try {
      const mcVersion = data?.mcVersion || DEFAULT_MC_VERSION;
      const fabricVersion = (await getLatestFabricLoaderForMcVersion(mcVersion)) || DEFAULT_FABRIC_LOADER_VERSION;

      const nativesReady = cachedDownloadResult?.nativesDir
        ? fs.existsSync(cachedDownloadResult.nativesDir) &&
          fs.readdirSync(cachedDownloadResult.nativesDir).some((file) => file.toLowerCase().endsWith(".dll")) &&
          fs.existsSync(path.join(cachedDownloadResult.nativesDir, ".arch")) &&
          fs.readFileSync(path.join(cachedDownloadResult.nativesDir, ".arch"), "utf-8").trim() === process.arch
        : false;

      if (!cachedDownloadResult || !nativesReady) {
        cachedDownloadResult = await downloadGame(
          mcVersion,
          fabricVersion,
          (progress: DownloadProgress) => {
            event.sender.send("game:downloadProgress", progress);
          }
        );
      }

      if (!cachedDownloadResult) {
        throw new Error("Download failed to produce launch data.");
      }

      const basePath = getBasePath();
      ensureBaseFolder(basePath);
      const gameDir = path.join(basePath, "quickplay");
      if (fs.existsSync(gameDir)) {
        fs.rmSync(gameDir, { recursive: true, force: true });
      }
      fs.mkdirSync(gameDir, { recursive: true });
      fs.mkdirSync(path.join(gameDir, "saves"), { recursive: true });
      fs.mkdirSync(path.join(gameDir, "logs"), { recursive: true });

      const options: LaunchOptions = {
        downloadResult: cachedDownloadResult,
        gameDir,
      };

      await launchGame(
        options,
        (line: string) => {
          event.sender.send("game:log", line);
        },
        async (code: number | null) => {
          try {
            await mods.processPendingSyncs();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("❌ Pending sync failed:", msg);
          }
          try {
            if (fs.existsSync(gameDir)) {
              fs.rmSync(gameDir, { recursive: true, force: true });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("❌ Quick Play cleanup failed:", msg);
          }
          event.sender.send("game:exit", code);
        },
        (jp) => {
          event.sender.send("game:downloadProgress", jp);
        }
      );

      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("❌ Quick Play failed:", msg);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("game:kill", () => {
    // Kill all tracked processes across all installations.
    for (const [id, procs] of gameProcesses.entries()) {
      for (const proc of procs) {
        proc.kill();
      }
      gameProcesses.delete(id);
    }
    // Also call old killGame for backwards compatibility
    killGame();
    return { ok: true };
  });

  // ========================================
  // Profile handlers
  // ========================================

  ipcMain.handle("profiles:getAll", async () => {
    try {
      const allProfiles = await profiles.getAllProfiles();
      return { ok: true, profiles: allProfiles };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:getByName", async (_event, name: string) => {
    try {
      const profile = await profiles.getProfileByName(name);
      return { ok: true, profile };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:create", async (_event, data: { name: string; description?: string }) => {
    try {
      const profile = await profiles.createProfile(data.name, data.description);
      return { ok: true, profile };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:update", async (_event, data: { id: string; updates: Partial<{ name: string; description: string; icon: string }> }) => {
    try {
      const profile = await profiles.updateProfile(data.id, data.updates);
      return { ok: true, profile };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:delete", async (_event, id: string) => {
    try {
      const result = await profiles.deleteProfile(id);
      return { ok: true, ...result };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:export", async (_event, profileId: string) => {
    try {
      const index = await profiles.loadProfilesIndex();
      const rawProfile = index.profiles[profileId];
      if (!rawProfile) {
        return { ok: false, error: "Profile not found" };
      }

      // Use folder dialog for folder-based export
      const safeName = sanitizeFileName(String(rawProfile.name || "Profile"));
      const result = await dialog.showOpenDialog({
        title: "Select Export Folder",
        properties: ["openDirectory", "createDirectory"],
        buttonLabel: "Export Here",
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      // Create a subfolder with the profile name
      const exportDir = path.join(result.filePaths[0], `${safeName}_Export`);
      
      // Check if folder already exists
      if (fs.existsSync(exportDir)) {
        const overwriteResult = await dialog.showMessageBox({
          type: "question",
          buttons: ["Overwrite", "Cancel"],
          defaultId: 1,
          title: "Folder Exists",
          message: `A folder named "${safeName}_Export" already exists in the selected location.`,
          detail: "Do you want to overwrite it?",
        });
        
        if (overwriteResult.response === 1) {
          return { ok: false, canceled: true };
        }
        
        // Remove existing folder
        fs.rmSync(exportDir, { recursive: true, force: true });
      }

      const exportResult = await exportProfileToFolder(profileId, exportDir);
      if (!exportResult.ok) {
        return { ok: false, error: exportResult.error };
      }

      return { ok: true, exportDir: exportResult.exportDir };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:exportCode", async (_event, profileId: string) => {
    try {
      const index = await profiles.loadProfilesIndex();
      const rawProfile = index.profiles[profileId];
      if (!rawProfile) {
        return { ok: false, error: "Profile not found" };
      }

      const { serialized } = buildProfileExportBundle(rawProfile);
      return { ok: true, bundle: serialized };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:import", async () => {
    try {
      // Use folder dialog for folder-based import
      const result = await dialog.showOpenDialog({
        title: "Select Profile Folder to Import",
        properties: ["openDirectory"],
        buttonLabel: "Import This Folder",
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const folderPath = result.filePaths[0];
      
      // Validate the folder
      const validation = validateProfileFolder(folderPath);
      if (!validation.valid) {
        return { ok: false, error: `Invalid profile folder: ${validation.error}` };
      }

      const importResult = await importProfileFromFolder(folderPath);
      if (!importResult.ok) {
        return { ok: false, error: importResult.error };
      }

      return { 
        ok: true, 
        profileId: importResult.profileId, 
        profileName: importResult.profileName,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:loadBundleFromFile", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Load Profile Export",
        filters: [
          { name: "Jojo Profile Export (*.jojoprofile.json)", extensions: ["json"] },
          { name: "JSON", extensions: ["json"] },
        ],
        properties: ["openFile"],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      if (!filePath.toLowerCase().endsWith(".jojoprofile.json") && !filePath.toLowerCase().endsWith(".json")) {
        return { ok: false, error: "Unsupported file type. Please select a .jojoprofile.json or .json file." };
      }
      const stats = fs.statSync(filePath);
      const maxBytes = 5 * 1024 * 1024;
      if (stats.size > maxBytes) {
        return { ok: false, error: "Profile export too large (max 5 MB)." };
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      return { ok: true, bundle: raw };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:importFromCode", async (_event, bundle: string) => {
    if (!bundle || typeof bundle !== "string") {
      return { ok: false, error: "Profile code is empty." };
    }
    const resultData = await importProfileFromBundle(bundle);
    return resultData;
  });

  // ========================================
  // Installation handlers
  // ========================================

  ipcMain.handle("installations:getAll", async () => {
    try {
      const allInstallations = await profiles.getAllInstallations();
      return { ok: true, installations: allInstallations };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("installations:getByProfile", async (_event, profileName: string) => {
    try {
      const installations = await profiles.getInstallationsByProfile(profileName);
      return { ok: true, installations };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("installations:getById", async (_event, id: string) => {
    try {
      const installation = await profiles.getInstallationById(id);
      return { ok: true, installation };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("installations:create", async (_event, data: { profileId: string; name: string; minecraftVersion: string; description?: string }) => {
    try {
      const result = await profiles.createInstallation(data.profileId, data.name, data.minecraftVersion, data.description);

      // Sync mods in the background so creation returns immediately.
      void (async () => {
        try {
          const installation = result.installation;
          const profile = await profiles.getProfileById(installation.profileId);
          if (!profile) return;

          const syncResult = await mods.syncProfileModsToInstallation(
            profile.id,
            installation.id,
            (progress) => {
              _event.sender.send("mods:downloadProgress", {
                installationId: installation.id,
                ...progress,
              });
            }
          );

          if (!syncResult.skipped) {
            if (syncResult.issues.length > 0) {
              await profiles.updateInstallation(installation.id, { modIssues: syncResult.issues } as any);
            } else {
              await profiles.updateInstallation(installation.id, { modIssues: [] } as any);
            }
          }
        } catch (err) {
          console.error("Background mod sync failed after installation create:", err);
        }
      })();

      return { ok: true, installation: result.installation };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("installations:update", async (_event, data: { id: string; updates: Partial<{ name: string; description: string; lastPlayedAt: string; playtimeSeconds: number }> }) => {
    try {
      const installation = await profiles.updateInstallation(data.id, data.updates);
      return { ok: true, installation };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("installations:delete", async (_event, id: string) => {
    try {
      await profiles.deleteInstallation(id);
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("installations:move", async (_event, data: { installationId: string; targetProfileId: string }) => {
    try {
      const installation = await profiles.moveInstallation(data.installationId, data.targetProfileId);
      return { ok: true, installation };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("installations:getGameDir", async (_event, installationId: string) => {
    try {
      const installation = await profiles.getInstallationById(installationId);
      if (!installation) {
        return { ok: false, error: "Installation not found" };
      }
      const gameDir = profiles.getInstallationDir(
        profiles.sanitizeName(installation.profileName),
        profiles.sanitizeName(installation.name)
      );
      return { ok: true, gameDir };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle(
    "mods:download",
    async (
      _event,
      data:
        | { type: "profile"; profileId: string; mcVersion: string; slug: string }
        | { type: "installation"; installationId: string; mcVersion: string; slug: string }
    ) => {
      try {
        const result = await mods.downloadMod(data);
        return { ok: true, file: result };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle("mods:addToProfile", async (_event, data: { profileId: string; slug: string; title?: string; iconUrl?: string | null }) => {
    try {
      await mods.addModToProfile(
        data.profileId,
        data.slug,
        data.title,
        data.iconUrl ?? null,
        (installationId, progress) => {
          _event.sender.send("mods:downloadProgress", {
            installationId,
            ...progress,
          });
        }
      );
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("mods:listProfile", async (_event, profileId: string) => {
    try {
      const modsList = await mods.listProfileMods(profileId);
      return { ok: true, mods: modsList };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("mods:listInstallation", async (_event, installationId: string) => {
    try {
      const modsList = await mods.listInstallationMods(installationId);
      return { ok: true, mods: modsList };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle(
    "mods:setEnabled",
    async (_event, data: { profileId: string; slug: string; enabled: boolean }) => {
      try {
        await mods.setProfileModEnabled(data.profileId, data.slug, data.enabled);
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    "mods:delete",
    async (
      _event,
      data:
        | { type: "profile"; profileId: string; slug: string }
        | { type: "installation"; installationId: string; filename: string }
    ) => {
      try {
        await mods.deleteMod(data);
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    "mods:exportBundle",
    async (_event, data: { profileId: string; slugs?: string[] }) => {
      try {
        const bundle = await mods.exportProfileModsBundle(data.profileId, data.slugs);
        return { ok: true, bundle };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    "mods:importBundle",
    async (_event, data: { profileId: string; bundle: string }) => {
      try {
        const result = await mods.importProfileModsBundle(data.profileId, data.bundle);
        return { ok: true, ...result };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    "mods:syncProfileToInstallations",
    async (_event, profileId: string) => {
      try {
        const profile = await profiles.getProfileById(profileId);
        if (!profile) {
          return { ok: false, error: "Profile not found" };
        }
        const installations = await profiles.getInstallationsByProfile(profile.name);
        const results: { installationId: string; failed: string[]; issues: any[] }[] = [];
        for (const installation of installations) {
          const syncResult = await mods.syncProfileModsToInstallation(profileId, installation.id);
          // Update installation with mod issues (skip if sync was a no-op cache hit)
          if (!syncResult.skipped) {
            if (syncResult.issues.length > 0) {
              await profiles.updateInstallation(installation.id, { modIssues: syncResult.issues } as any);
            } else {
              // Clear mod issues if sync was fully successful
              await profiles.updateInstallation(installation.id, { modIssues: [] } as any);
            }
          }
          results.push({ installationId: installation.id, failed: syncResult.failed, issues: syncResult.issues });
        }
        return { ok: true, syncedCount: installations.length, results };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    "mods:syncInstallation",
    async (event, installationId: string) => {
      try {
        const installation = await profiles.getInstallationById(installationId);
        if (!installation) {
          return { ok: false, error: "Installation not found" };
        }
        const profile = await profiles.getProfileById(installation.profileId);
        if (!profile) {
          return { ok: false, error: "Profile not found" };
        }

        const syncResult = await mods.syncProfileModsToInstallation(
          profile.id,
          installation.id,
          (progress) => {
            event.sender.send("mods:downloadProgress", {
              installationId: installation.id,
              ...progress,
            });
          }
        );

        if (!syncResult.skipped) {
          if (syncResult.issues.length > 0) {
            await profiles.updateInstallation(installation.id, { modIssues: syncResult.issues } as any);
          } else {
            await profiles.updateInstallation(installation.id, { modIssues: [] } as any);
          }
        }

        return { ok: true, failed: syncResult.failed, issues: syncResult.issues };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle("mods:loadBundleFromFile", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Import Mods",
        filters: [{ name: "JojoClient Mods Bundle", extensions: ["jojo"] }],
        properties: ["openFile"]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const bundle = exportImport.loadBundleFromFile(result.filePaths[0]);
      return { ok: true, bundle };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  // ========================================
  // Template sync handlers
  // ========================================

  ipcMain.handle("installations:syncFromTemplate", async (_event, installationId: string) => {
    try {
      const success = await profiles.syncTemplateToInstallation(installationId);
      return { ok: true, synced: success };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:updateTemplateFromInstallation", async (_event, installationId: string) => {
    try {
      const success = await profiles.updateTemplateFromInstallation(installationId);
      return { ok: true, synced: success };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:exportSettingsBundle", async (_event, profileId: string) => {
    try {
      const bundle = await profiles.exportProfileSettingsBundle(profileId);
      return { ok: true, bundle };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("profiles:importSettingsBundle", async (_event, data: { profileId: string; bundle: string }) => {
    try {
      const result = await profiles.importProfileSettingsBundle(data.profileId, data.bundle);
      return { ok: true, ...result };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  // ========================================
  // Export/Import handlers
  // ========================================

  ipcMain.handle("export:profile", async (_event, profileId: string) => {
    try {
      const bundle = await exportImport.exportProfileBundle(profileId);
      return { ok: true, bundle };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("export:installation", async (_event, installationId: string) => {
    try {
      const bundle = await exportImport.exportInstallationBundle(installationId);
      return { ok: true, bundle };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("export:saveToFile", async (_event, data: { bundle: string; defaultName: string }) => {
    try {
      const result = await dialog.showSaveDialog({
        title: "Save Export",
        defaultPath: data.defaultName + ".jojo",
        filters: [{ name: "JojoClient Export", extensions: ["jojo"] }]
      });
      
      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }
      
      exportImport.saveBundleToFile(data.bundle, result.filePath);
      return { ok: true, filePath: result.filePath };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("import:loadFromFile", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Import Profile or Installation",
        filters: [{ name: "JojoClient Export", extensions: ["jojo"] }],
        properties: ["openFile"]
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }
      
      const bundle = exportImport.loadBundleFromFile(result.filePaths[0]);
      const metadata = exportImport.getBundleMetadata(bundle);
      const type = exportImport.getBundleType(bundle);
      
      return { ok: true, bundle, metadata, type };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("import:profile", async (_event, data: { bundle: string; newName?: string }) => {
    try {
      const profile = await exportImport.importProfileBundle(data.bundle, data.newName);
      return { ok: true, profile };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("import:installation", async (_event, data: { bundle: string; targetProfileId: string; newName?: string }) => {
    try {
      let shouldSyncMods = true;
      try {
        const jsonStr = Buffer.from(data.bundle, "base64").toString("utf-8");
        const parsed = JSON.parse(jsonStr) as { type?: string; files?: { mods?: unknown[] } };
        if (parsed?.type === "installation-bundle") {
          const modsCount = Array.isArray(parsed.files?.mods) ? parsed.files?.mods.length : 0;
          shouldSyncMods = modsCount === 0;
        }
      } catch {
        // Ignore parse errors here; import handler will validate the bundle.
      }

      const installation = await exportImport.importInstallationBundle(data.bundle, data.targetProfileId, data.newName);

      if (shouldSyncMods) {
        void (async () => {
          try {
            const profile = await profiles.getProfileById(installation.profileId);
            if (!profile) return;

            const syncResult = await mods.syncProfileModsToInstallation(
              profile.id,
              installation.id,
              (progress) => {
                _event.sender.send("mods:downloadProgress", {
                  installationId: installation.id,
                  ...progress,
                });
              }
            );

            if (!syncResult.skipped) {
              if (syncResult.issues.length > 0) {
                await profiles.updateInstallation(installation.id, { modIssues: syncResult.issues } as any);
              } else {
                await profiles.updateInstallation(installation.id, { modIssues: [] } as any);
              }
            }
          } catch (err) {
            console.error("Background mod sync failed after installation import:", err);
          }
        })();
      }

      return { ok: true, installation };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  // ========================================
  // Utility handlers
  // ========================================

  ipcMain.handle("fabric:getLatestForVersion", async (_event, mcVersion: string) => {
    try {
      const fabricVersion = await getLatestFabricLoaderForMcVersion(mcVersion);
      return { ok: true, fabricVersion };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  // ========================================
  // Auto-updater handlers
  // ========================================

  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  ipcMain.handle("app:checkForUpdates", async () => {
    if (isDev) {
      return { ok: false, error: "Updates not available in development mode" };
    }
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("app:downloadUpdate", async () => {
    if (isDev) {
      return { ok: false, error: "Updates not available in development mode" };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle("app:installUpdate", () => {
    if (isDev) {
      return { ok: false, error: "Updates not available in development mode" };
    }
    // This will quit the app and install the update
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  createWindow();
});
