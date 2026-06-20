import { app } from "electron";
import fs from "fs";
import path from "path";

export type LauncherSettings = {
  basePath: string | null;
  windowBounds?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized?: boolean;
  };
};

const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");

export function readSettings(): LauncherSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { basePath: null };
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<LauncherSettings>;
    return {
      basePath: parsed.basePath ?? null,
      windowBounds: parsed.windowBounds,
    };
  } catch {
    return { basePath: null };
  }
}

export function writeSettings(settings: LauncherSettings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}