/// <reference types="vite/client" />
export {}

type MinecraftAccount = {
  accessToken: string
  username: string
  uuid: string
  expiresAt: number
}

type AuthResult = {
  ok: boolean
  error?: string
  account?: MinecraftAccount | null
}

type GameStatus = {
  isDownloaded: boolean
  isRunning: boolean
  mcVersion: string
  fabricVersion: string
}

type DownloadProgress = {
  phase: "preparing" | "libraries" | "assets" | "client" | "done"
  current: number
  total: number
  currentFile?: string
}

type ModDownloadProgress = {
  phase: "start" | "mod" | "done"
  current: number
  total: number
  slug?: string
  installationId?: string
}

type Profile = {
  id: string
  name: string
  description?: string
  icon?: string
  createdAt: string
  updatedAt: string
  isDefault?: boolean
}

type Installation = {
  id: string
  name: string
  profileId: string
  minecraftVersion: string
  fabricLoaderVersion: string
  matchesProfileVersion: boolean
  description?: string
  createdAt: string
  lastPlayedAt?: string
  playtimeSeconds: number
  modIssues?: Array<{ slug: string; modName: string; error: string; details?: string; timestamp: number }>
}

type InstallationWithProfile = Installation & { profileName: string }

type BundleMetadata = {
  type: string
  name: string
  minecraftVersion: string
  exportedAt: string
  clientVersion: string
}

declare global {
  interface Window {
    jojoclient: {
      // Window Controls
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      windowIsMaximized: () => Promise<boolean>

      // Settings
      getSettings: () => Promise<{ basePath: string | null }>
      pickBaseFolder: () => Promise<{ ok: boolean; path?: string; canceled?: boolean }>
      setBaseFolder: (basePath: string) => Promise<{ ok: boolean; error?: string }>
      
      // Auth
      login: () => Promise<AuthResult>
      logout: (uuid?: string) => Promise<{ ok: boolean }>
      getAccount: () => Promise<AuthResult>
      getAccounts: () => Promise<{ ok: boolean; accounts?: Array<{ username: string; uuid: string }>; error?: string }>
      setActiveAccount: (uuid: string) => Promise<{ ok: boolean; error?: string }>
      
      // Game
      getGameStatus: () => Promise<GameStatus>
      downloadGame: () => Promise<{ ok: boolean; error?: string }>
      launchGame: (data: { mcVersion: string; fabricVersion: string; installationId: string }) => Promise<{ ok: boolean; error?: string }>
      launchQuickGame: (data: { mcVersion: string }) => Promise<{ ok: boolean; error?: string }>
      killGame: () => Promise<{ ok: boolean }>
      
      // Profiles
      getAllProfiles: () => Promise<{ ok: boolean; profiles?: Profile[]; error?: string }>
      getProfileByName: (name: string) => Promise<{ ok: boolean; profile?: Profile | null; error?: string }>
      createProfile: (data: { name: string; description?: string }) => 
        Promise<{ ok: boolean; profile?: Profile; error?: string }>
      updateProfile: (data: { id: string; updates: Partial<{ name: string; description: string; icon: string }> }) => 
        Promise<{ ok: boolean; profile?: Profile; error?: string }>
      deleteProfile: (id: string) => Promise<{ ok: boolean; movedInstallations?: string[]; error?: string }>
      updateTemplateFromInstallation: (installationId: string) => 
        Promise<{ ok: boolean; synced?: boolean; error?: string }>
      exportProfileSettingsBundle: (profileId: string) =>
        Promise<{ ok: boolean; bundle?: string; error?: string }>
      importProfileSettingsBundle: (data: { profileId: string; bundle: string }) =>
        Promise<{ ok: boolean; applied?: boolean; reason?: string; error?: string }>
      exportProfileFile: (profileId: string) =>
        Promise<{ ok: boolean; filePath?: string; bundle?: string; canceled?: boolean; exportDir?: string; error?: string }>
      exportProfileCode: (profileId: string) =>
        Promise<{ ok: boolean; bundle?: string; error?: string }>
      importProfileFile: () =>
        Promise<{ ok: boolean; profileId?: string; profileName?: string; profileFilesCount?: number; templateFilesCount?: number; hasModsJson?: boolean; canceled?: boolean; error?: string }>
      loadProfileBundleFromFile: () =>
        Promise<{ ok: boolean; bundle?: string; canceled?: boolean; error?: string }>
      importProfileFromCode: (bundle: string) =>
        Promise<{ ok: boolean; profileId?: string; profileName?: string; profileFilesCount?: number; templateFilesCount?: number; hasModsJson?: boolean; error?: string }>
      
      // Installations
      getAllInstallations: () => Promise<{ ok: boolean; installations?: InstallationWithProfile[]; error?: string }>
      getInstallationsByProfile: (profileName: string) => 
        Promise<{ ok: boolean; installations?: Installation[]; error?: string }>
      getInstallationById: (id: string) => 
        Promise<{ ok: boolean; installation?: InstallationWithProfile | null; error?: string }>
      createInstallation: (data: { profileId: string; name: string; minecraftVersion: string; description?: string }) => 
        Promise<{ ok: boolean; installation?: Installation; error?: string }>
      updateInstallation: (data: { id: string; updates: Partial<{ name: string; description: string; lastPlayedAt: string; playtimeSeconds: number }> }) => 
        Promise<{ ok: boolean; installation?: Installation; error?: string }>
      deleteInstallation: (id: string) => Promise<{ ok: boolean; error?: string }>
      moveInstallation: (data: { installationId: string; targetProfileId: string }) => 
        Promise<{ ok: boolean; installation?: Installation; error?: string }>
      getInstallationGameDir: (installationId: string) => 
        Promise<{ ok: boolean; gameDir?: string; error?: string }>
      syncInstallationFromTemplate: (installationId: string) => 
        Promise<{ ok: boolean; synced?: boolean; error?: string }>
      
      // Export/Import
      exportProfile: (profileId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>
      exportInstallation: (installationId: string) => Promise<{ ok: boolean; bundle?: string; error?: string }>
      saveExportToFile: (data: { bundle: string; defaultName: string }) => 
        Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>
      loadImportFromFile: () => 
        Promise<{ ok: boolean; bundle?: string; metadata?: BundleMetadata | null; type?: string; canceled?: boolean; error?: string }>
      importProfile: (data: { bundle: string; newName?: string }) => 
        Promise<{ ok: boolean; profile?: Profile; error?: string }>
      importInstallation: (data: { bundle: string; targetProfileId: string; newName?: string }) => 
        Promise<{ ok: boolean; installation?: Installation; error?: string }>

      // Mods
      downloadMod: (data: { type: "profile" | "installation"; profileId?: string; installationId?: string; mcVersion: string; slug: string }) =>
        Promise<{ ok: boolean; file?: { filename: string; path: string }; error?: string }>
      addProfileMod: (data: { profileId: string; slug: string; title?: string; iconUrl?: string | null }) =>
        Promise<{ ok: boolean; error?: string }>
      listProfileMods: (profileId: string) =>
        Promise<{ ok: boolean; mods?: Array<{ id: string; name: string; filename: string; version: string; enabled: boolean; slug?: string; iconUrl?: string | null }>; error?: string }>
      setProfileModEnabled: (data: { profileId: string; slug: string; enabled: boolean }) =>
        Promise<{ ok: boolean; error?: string }>
      listInstallationMods: (installationId: string) =>
        Promise<{ ok: boolean; mods?: Array<{ id: string; name: string; filename: string; version: string; enabled: boolean }>; error?: string }>
      deleteMod: (data: { type: "profile" | "installation"; profileId?: string; installationId?: string; slug?: string; filename?: string }) =>
        Promise<{ ok: boolean; error?: string }>
      exportProfileMods: (data: { profileId: string; slugs?: string[] }) =>
        Promise<{ ok: boolean; bundle?: string; error?: string }>
      importProfileMods: (data: { profileId: string; bundle: string }) =>
        Promise<{ ok: boolean; added?: number; skipped?: number; settingsAdded?: number; settingsSkipped?: number; error?: string }>
      loadModsBundleFromFile: () =>
        Promise<{ ok: boolean; bundle?: string; canceled?: boolean; error?: string }>
      syncProfileModsToInstallations: (profileId: string) =>
        Promise<{ ok: boolean; syncedCount?: number; results?: Array<{ installationId: string; failed: string[]; issues?: Array<{ slug: string; modName: string; error: string; details?: string; timestamp: number }> }>; error?: string }>
      syncInstallationMods: (installationId: string) =>
        Promise<{ ok: boolean; failed?: string[]; issues?: Array<{ slug: string; modName: string; error: string; details?: string; timestamp: number }>; error?: string }>
      
      // Utilities
      getLatestFabricForVersion: (mcVersion: string) => 
        Promise<{ ok: boolean; fabricVersion?: string | null; error?: string }>
      
      // Shell
      openFolder: (folderPath: string) => Promise<{ ok: boolean; error?: string }>
      
      // Game Events
      onDownloadProgress: (cb: (progress: DownloadProgress) => void) => () => void
      onGameLog: (cb: (line: string) => void) => () => void
      onGameExit: (cb: (code: number | null) => void) => () => void
      onModsDownloadProgress: (cb: (progress: ModDownloadProgress) => void) => () => void
      
      // Auto-updater
      getAppVersion: () => Promise<string>
      checkForUpdates: () => Promise<{ ok: boolean; error?: string }>
      downloadUpdate: () => Promise<{ ok: boolean; error?: string }>
      installUpdate: () => Promise<{ ok: boolean; error?: string }>
      onUpdateAvailable: (cb: (info: { version: string; releaseDate?: string; releaseName?: string }) => void) => () => void
      onUpdateNotAvailable: (cb: () => void) => () => void
      onUpdateDownloadProgress: (cb: (progress: { percent: number; transferred: number; total: number }) => void) => () => void
      onUpdateDownloaded: (cb: () => void) => () => void
      onUpdateError: (cb: (error: string) => void) => () => void

      // Events
      onMainMessage?: (cb: (message: string) => void) => () => void
    }
  }
}