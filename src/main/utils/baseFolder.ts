import fs from "fs";
import path from "path";
import { readSettings } from "./storage";

const MARKER_FILE = ".jojoclient";
const DEFAULT_BASE_PATH = path.join(process.env.USERPROFILE || process.env.HOME || ".", "Documents", "JojoClient");

/**
 * Get the base path from settings, or use a default
 */
export function getBasePath(): string {
  const settings = readSettings();
  return settings.basePath || DEFAULT_BASE_PATH;
}

export function ensureBaseFolder(basePath: string) {
  fs.mkdirSync(basePath, { recursive: true });

  const requiredDirs = ["launcher", "installations", "profiles", "exports", "cache", "logs"];
  for (const dir of requiredDirs) {
    fs.mkdirSync(path.join(basePath, dir), { recursive: true });
  }

  const markerPath = path.join(basePath, MARKER_FILE);
  if (!fs.existsSync(markerPath)) {
    fs.writeFileSync(markerPath, "JojoClient base folder", "utf-8");
  }
}
