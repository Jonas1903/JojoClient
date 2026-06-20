import { contextBridge, ipcRenderer } from "electron";

console.log("✅ JojoClient preload loaded");

contextBridge.exposeInMainWorld("jojoclient", {
  // Window Controls
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  pickBaseFolder: () => ipcRenderer.invoke("baseFolder:pick"),
  setBaseFolder: (basePath: string) => ipcRenderer.invoke("baseFolder:set", basePath),
  
  // Auth
  login: () => ipcRenderer.invoke("auth:login"),
  logout: (uuid?: string) => ipcRenderer.invoke("auth:logout", uuid),
  getAccount: () => ipcRenderer.invoke("auth:getAccount"),
  getAccounts: () => ipcRenderer.invoke("auth:getAccounts"),
  setActiveAccount: (uuid: string) => ipcRenderer.invoke("auth:setActive", uuid),
  
  // Game
  getGameStatus: () => ipcRenderer.invoke("game:getStatus"),
  downloadGame: () => ipcRenderer.invoke("game:download"),
  launchGame: (data: { mcVersion: string; fabricVersion: string; installationId: string }) => 
    ipcRenderer.invoke("game:launch", data),
  launchQuickGame: (data: { mcVersion: string }) => ipcRenderer.invoke("game:launchQuick", data),
  killGame: () => ipcRenderer.invoke("game:kill"),
  
  // Profiles
  getAllProfiles: () => ipcRenderer.invoke("profiles:getAll"),
  getProfileByName: (name: string) => ipcRenderer.invoke("profiles:getByName", name),
  createProfile: (data: { name: string; description?: string }) => 
    ipcRenderer.invoke("profiles:create", data),
  updateProfile: (data: { id: string; updates: Record<string, unknown> }) => 
    ipcRenderer.invoke("profiles:update", data),
  deleteProfile: (id: string) => ipcRenderer.invoke("profiles:delete", id),
  updateTemplateFromInstallation: (installationId: string) => 
    ipcRenderer.invoke("profiles:updateTemplateFromInstallation", installationId),
  exportProfileSettingsBundle: (profileId: string) =>
    ipcRenderer.invoke("profiles:exportSettingsBundle", profileId),
  importProfileSettingsBundle: (data: { profileId: string; bundle: string }) =>
    ipcRenderer.invoke("profiles:importSettingsBundle", data),
  exportProfileFile: (profileId: string) =>
    ipcRenderer.invoke("profiles:export", profileId),
  exportProfileCode: (profileId: string) =>
    ipcRenderer.invoke("profiles:exportCode", profileId),
  importProfileFile: () => ipcRenderer.invoke("profiles:import"),
  loadProfileBundleFromFile: () => ipcRenderer.invoke("profiles:loadBundleFromFile"),
  importProfileFromCode: (bundle: string) => ipcRenderer.invoke("profiles:importFromCode", bundle),
  
  // Installations
  getAllInstallations: () => ipcRenderer.invoke("installations:getAll"),
  getInstallationsByProfile: (profileName: string) => 
    ipcRenderer.invoke("installations:getByProfile", profileName),
  getInstallationById: (id: string) => ipcRenderer.invoke("installations:getById", id),
  createInstallation: (data: { profileId: string; name: string; minecraftVersion?: string; description?: string }) => 
    ipcRenderer.invoke("installations:create", data),
  updateInstallation: (data: { id: string; updates: Record<string, unknown> }) => 
    ipcRenderer.invoke("installations:update", data),
  deleteInstallation: (id: string) => ipcRenderer.invoke("installations:delete", id),
  moveInstallation: (data: { installationId: string; targetProfileId: string }) => 
    ipcRenderer.invoke("installations:move", data),
  getInstallationGameDir: (installationId: string) => 
    ipcRenderer.invoke("installations:getGameDir", installationId),
  syncInstallationFromTemplate: (installationId: string) => 
    ipcRenderer.invoke("installations:syncFromTemplate", installationId),
  
  // Export/Import
  exportProfile: (profileId: string) => ipcRenderer.invoke("export:profile", profileId),
  exportInstallation: (installationId: string) => ipcRenderer.invoke("export:installation", installationId),
  saveExportToFile: (data: { bundle: string; defaultName: string }) => 
    ipcRenderer.invoke("export:saveToFile", data),
  loadImportFromFile: () => ipcRenderer.invoke("import:loadFromFile"),
  importProfile: (data: { bundle: string; newName?: string }) => 
    ipcRenderer.invoke("import:profile", data),
  importInstallation: (data: { bundle: string; targetProfileId: string; newName?: string }) => 
    ipcRenderer.invoke("import:installation", data),

  // Mods
  downloadMod: (data: { type: "profile" | "installation"; profileId?: string; installationId?: string; mcVersion: string; slug: string }) =>
    ipcRenderer.invoke("mods:download", data),
  addProfileMod: (data: { profileId: string; slug: string; title?: string; iconUrl?: string | null }) =>
    ipcRenderer.invoke("mods:addToProfile", data),
  listProfileMods: (profileId: string) => ipcRenderer.invoke("mods:listProfile", profileId),
  setProfileModEnabled: (data: { profileId: string; slug: string; enabled: boolean }) =>
    ipcRenderer.invoke("mods:setEnabled", data),
  listInstallationMods: (installationId: string) => ipcRenderer.invoke("mods:listInstallation", installationId),
  deleteMod: (data: { type: "profile" | "installation"; profileId?: string; installationId?: string; filename: string }) =>
    ipcRenderer.invoke("mods:delete", data),
  exportProfileMods: (data: { profileId: string; slugs?: string[] }) =>
    ipcRenderer.invoke("mods:exportBundle", data),
  importProfileMods: (data: { profileId: string; bundle: string }) =>
    ipcRenderer.invoke("mods:importBundle", data),
  loadModsBundleFromFile: () => ipcRenderer.invoke("mods:loadBundleFromFile"),
  syncProfileModsToInstallations: (profileId: string) =>
    ipcRenderer.invoke("mods:syncProfileToInstallations", profileId),
  syncInstallationMods: (installationId: string) =>
    ipcRenderer.invoke("mods:syncInstallation", installationId),
  
  // Utilities
  getLatestFabricForVersion: (mcVersion: string) => 
    ipcRenderer.invoke("fabric:getLatestForVersion", mcVersion),
  
  // Shell
  openFolder: (folderPath: string) => ipcRenderer.invoke("shell:openFolder", folderPath),

  // Game Events
  onDownloadProgress: (cb: (progress: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => cb(progress);
    ipcRenderer.on("game:downloadProgress", handler);
    return () => ipcRenderer.removeListener("game:downloadProgress", handler);
  },
  onGameLog: (cb: (line: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, line: string) => cb(line);
    ipcRenderer.on("game:log", handler);
    return () => ipcRenderer.removeListener("game:log", handler);
  },
  onGameExit: (cb: (code: number | null) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, code: number | null) => cb(code);
    ipcRenderer.on("game:exit", handler);
    return () => ipcRenderer.removeListener("game:exit", handler);
  },
  onModsDownloadProgress: (cb: (progress: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => cb(progress);
    ipcRenderer.on("mods:downloadProgress", handler);
    return () => ipcRenderer.removeListener("mods:downloadProgress", handler);
  },
  onInstanceProgress: (cb: (progress: { phase: string; current: number; total: number; currentFile?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { phase: string; current: number; total: number; currentFile?: string }) => cb(progress);
    ipcRenderer.on("instance:progress", handler);
    return () => ipcRenderer.removeListener("instance:progress", handler);
  },
  
  // Events
  onMainMessage: (cb: (message: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => cb(message);
    ipcRenderer.on("main-process-message", handler);
    return () => ipcRenderer.removeListener("main-process-message", handler);
  },

  // Auto-updater
  getAppVersion: () => ipcRenderer.invoke("app:getVersion"),
  checkForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
  downloadUpdate: () => ipcRenderer.invoke("app:downloadUpdate"),
  installUpdate: () => ipcRenderer.invoke("app:installUpdate"),
  onUpdateAvailable: (cb: (info: { version: string; releaseDate?: string; releaseName?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { version: string; releaseDate?: string; releaseName?: string }) => cb(info);
    ipcRenderer.on("app:update-available", handler);
    return () => ipcRenderer.removeListener("app:update-available", handler);
  },
  onUpdateNotAvailable: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("app:update-not-available", handler);
    return () => ipcRenderer.removeListener("app:update-not-available", handler);
  },
  onUpdateDownloadProgress: (cb: (progress: { percent: number; transferred: number; total: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { percent: number; transferred: number; total: number }) => cb(progress);
    ipcRenderer.on("app:update-download-progress", handler);
    return () => ipcRenderer.removeListener("app:update-download-progress", handler);
  },
  onUpdateDownloaded: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("app:update-downloaded", handler);
    return () => ipcRenderer.removeListener("app:update-downloaded", handler);
  },
  onUpdateError: (cb: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => cb(error);
    ipcRenderer.on("app:update-error", handler);
    return () => ipcRenderer.removeListener("app:update-error", handler);
  },
});