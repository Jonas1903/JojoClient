import type { InstallationWithProfile } from "./main/types";

export type Settings = { basePath: string | null };
export type AccountData = { username: string; uuid: string };
export type Account = AccountData | null;
export type GameState = "idle" | "downloading" | "running";
export type Tab = "play" | "profiles" | "mods" | "partner" | "settings";
export type ModsSubTab = "own" | "search";

export type DownloadProgress = {
  phase: string;
  current: number;
  total: number;
  currentFile?: string;
};

export type ModDownloadProgress = {
  phase: "start" | "mod" | "validate" | "done";
  current: number;
  total: number;
  slug?: string;
  installationId?: string;
};

// The IPC layer always augments installations with the parent profile name.
export type Installation = InstallationWithProfile;
