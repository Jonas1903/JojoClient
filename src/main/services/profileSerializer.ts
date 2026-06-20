import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  CURRENT_PROFILE_SCHEMA_VERSION,
  PROFILE_EXPORT_FORMAT,
  ProfileExportEnvelope,
  ProfileTemplateFile,
  ProfileRootFile,
} from "./profileExportSchema";
import {
  getProfilesDir,
  getProfileTemplateDir,
  getInstallationsDir,
  loadProfilesIndex,
  saveProfilesIndex,
  saveInstallationsIndex,
  sanitizeName,
} from "./profiles";
import type { ProfilesIndex } from "../types";

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function serializeProfile(profile: Record<string, unknown>): Record<string, unknown> {
  return deepClone(profile);
}

export function deserializeProfile(profile: unknown): Record<string, unknown> {
  if (!isPlainObject(profile)) {
    throw new Error("Invalid profile payload");
  }
  return deepClone(profile);
}

export function buildProfileExport(
  profile: Record<string, unknown>,
  templateFiles: ProfileTemplateFile[],
  profileFiles: ProfileRootFile[]
): ProfileExportEnvelope {
  return {
    format: PROFILE_EXPORT_FORMAT,
    schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: serializeProfile(profile),
    templateFiles,
    profileFiles,
  };
}

export function migrateProfileExport(data: ProfileExportEnvelope): ProfileExportEnvelope {
  if (data.schemaVersion > CURRENT_PROFILE_SCHEMA_VERSION) {
    throw new Error("Profile export schema is newer than this launcher version.");
  }

  let current = deepClone(data);
  while (current.schemaVersion < CURRENT_PROFILE_SCHEMA_VERSION) {
    if (current.schemaVersion === 1) {
      current = {
        ...current,
        templateFiles: current.templateFiles ?? [],
        profileFiles: current.profileFiles ?? [],
      };
    }
    current.schemaVersion += 1;
  }

  current.schemaVersion = CURRENT_PROFILE_SCHEMA_VERSION;
  current.templateFiles = current.templateFiles ?? [];
  current.profileFiles = current.profileFiles ?? [];
  return current;
}

export function collectProfileFiles(
  profileDir: string,
  templateDir: string,
  installationsDir: string
): ProfileRootFile[] {
  const files: ProfileRootFile[] = [];
  if (!fs.existsSync(profileDir)) return files;

  const templateRoot = path.resolve(templateDir);
  const installationsRoot = path.resolve(installationsDir);

  const collectRecursive = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const resolved = path.resolve(fullPath);

      if (resolved === templateRoot || resolved.startsWith(`${templateRoot}${path.sep}`)) {
        continue;
      }
      if (resolved === installationsRoot || resolved.startsWith(`${installationsRoot}${path.sep}`)) {
        continue;
      }

      if (entry.isDirectory()) {
        collectRecursive(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(profileDir, fullPath).replace(/\\/g, "/");
        const content = fs.readFileSync(fullPath).toString("base64");
        files.push({ path: relativePath, content });
      }
    }
  };

  collectRecursive(profileDir);
  return files;
}

export function collectTemplateFiles(templateDir: string): ProfileTemplateFile[] {
  const files: ProfileTemplateFile[] = [];
  if (!fs.existsSync(templateDir)) return files;

  // Folders to exclude from export (resource packs and shaderpacks are user-specific)
  const excludedFolders = ['resourcepacks', 'shaderpacks'];

  const collectRecursive = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip excluded folders at the root level of template
        const relativePath = path.relative(templateDir, fullPath);
        if (excludedFolders.includes(relativePath)) {
          continue;
        }
        collectRecursive(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(templateDir, fullPath).replace(/\\/g, "/");
        const content = fs.readFileSync(fullPath).toString("base64");
        files.push({ path: relativePath, content });
      }
    }
  };

  collectRecursive(templateDir);
  return files;
}

export function applyTemplateFiles(templateDir: string, files: ProfileTemplateFile[]): void {
  if (fs.existsSync(templateDir)) {
    fs.rmSync(templateDir, { recursive: true, force: true });
  }
  fs.mkdirSync(templateDir, { recursive: true });

  for (const file of files) {
    const targetPath = path.resolve(templateDir, file.path);
    if (!targetPath.startsWith(path.resolve(templateDir))) {
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, Buffer.from(file.content, "base64"));
  }
}

export function applyProfileFiles(profileDir: string, files: ProfileRootFile[]): void {
  fs.mkdirSync(profileDir, { recursive: true });
  const root = path.resolve(profileDir);

  for (const file of files) {
    const targetPath = path.resolve(profileDir, file.path);
    if (!targetPath.startsWith(root)) {
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, Buffer.from(file.content, "base64"));
  }
}

async function ensureProfileFolders(profileName: string, profileId: string): Promise<void> {
  const sanitized = sanitizeName(profileName);
  const profilesDir = getProfilesDir();
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }

  const templateDir = getProfileTemplateDir(sanitized);
  const installationsDir = getInstallationsDir(sanitized);

  fs.mkdirSync(templateDir, { recursive: true });
  fs.mkdirSync(path.join(templateDir, "mods"), { recursive: true });
  fs.mkdirSync(path.join(templateDir, "config"), { recursive: true });
  fs.mkdirSync(path.join(templateDir, "resourcepacks"), { recursive: true });
  fs.mkdirSync(path.join(templateDir, "shaderpacks"), { recursive: true });
  fs.mkdirSync(installationsDir, { recursive: true });

  await saveInstallationsIndex(sanitized, {
    version: 1,
    profileId,
    installations: {},
  });
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim();
}

export function resolveProfileConflicts(
  profile: Record<string, unknown>,
  index: ProfilesIndex
): Record<string, unknown> {
  const existingIds = new Set(Object.keys(index.profiles));
  const existingNames = new Set(Object.values(index.profiles).map((p) => p.name.toLowerCase()));

  const resolved = deepClone(profile);
  const rawId = typeof resolved.id === "string" ? resolved.id : "";
  const rawName = typeof resolved.name === "string" ? resolved.name : "Imported Profile";

  if (!rawId || existingIds.has(rawId)) {
    resolved.id = crypto.randomUUID();
  }

  let candidateName = rawName;
  if (existingNames.has(candidateName.toLowerCase())) {
    candidateName = `${candidateName} (Imported)`;
  }

  let counter = 2;
  let finalName = candidateName;
  while (existingNames.has(finalName.toLowerCase())) {
    finalName = `${candidateName} (${counter++})`;
  }

  resolved.name = sanitizeFileName(finalName);
  resolved.updatedAt = new Date().toISOString();

  return resolved;
}

export async function persistImportedProfile(profile: Record<string, unknown>): Promise<string> {
  if (typeof profile.id !== "string" || typeof profile.name !== "string") {
    throw new Error("Imported profile is missing required fields.");
  }

  const index = await loadProfilesIndex();
  index.profiles[profile.id] = profile as never;
  await saveProfilesIndex(index);

  await ensureProfileFolders(profile.name, profile.id);

  return profile.id;
}

// ============================================
// Folder-based Export/Import
// ============================================

const PROFILE_MANIFEST_FILENAME = "profile.json";

export interface FolderExportManifest {
  format: typeof PROFILE_EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  profile: Record<string, unknown>;
  /** Files stored in the profile root (like mods.json) */
  profileFiles?: ProfileRootFile[];
}

function copyDirectoryRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (!stats.isDirectory()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Export a profile to a folder structure:
 * <exportDir>/
 *   profile.json      - Profile metadata and settings
 *   mods/             - Mod JAR files
 *   config/           - Mod config files
 *   resourcepacks/    - Resource packs
 *   shaderpacks/      - Shader packs
 *   options.txt       - Minecraft options (if exists)
 */
export async function exportProfileToFolder(
  profileId: string,
  exportDir: string
): Promise<{ ok: true; exportDir: string } | { ok: false; error: string }> {
  try {
    const index = await loadProfilesIndex();
    const profile = index.profiles[profileId];

    if (!profile) {
      return { ok: false, error: `Profile with ID "${profileId}" not found` };
    }

    const profileName = sanitizeName(profile.name);
    const templateDir = getProfileTemplateDir(profileName);
    const profileDir = path.join(getProfilesDir(), profileName);
    const installationsDir = getInstallationsDir(profileName);

    // Create export directory
    fs.mkdirSync(exportDir, { recursive: true });

    // Collect profile root files (like mods.json) - these go into the manifest
    const profileFiles = collectProfileFiles(profileDir, templateDir, installationsDir);

    // Create manifest
    const manifest: FolderExportManifest = {
      format: PROFILE_EXPORT_FORMAT,
      schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile: serializeProfile(profile as unknown as Record<string, unknown>),
      profileFiles,
    };

    // Write manifest
    fs.writeFileSync(
      path.join(exportDir, PROFILE_MANIFEST_FILENAME),
      JSON.stringify(manifest, null, 2)
    );

    // Copy template folders directly (actual files, not base64)
    const foldersToExport = ["mods", "config", "resourcepacks", "shaderpacks"];
    for (const folder of foldersToExport) {
      const srcFolder = path.join(templateDir, folder);
      const destFolder = path.join(exportDir, folder);
      if (fs.existsSync(srcFolder)) {
        copyDirectoryRecursive(srcFolder, destFolder);
      }
    }

    // Copy options.txt if exists
    const optionsPath = path.join(templateDir, "options.txt");
    if (fs.existsSync(optionsPath)) {
      fs.copyFileSync(optionsPath, path.join(exportDir, "options.txt"));
    }

    return { ok: true, exportDir };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Import a profile from a folder structure.
 * The folder must contain a profile.json manifest file.
 */
export async function importProfileFromFolder(
  importDir: string,
  newName?: string
): Promise<{ ok: true; profileId: string; profileName: string } | { ok: false; error: string }> {
  try {
    const manifestPath = path.join(importDir, PROFILE_MANIFEST_FILENAME);

    if (!fs.existsSync(manifestPath)) {
      return { ok: false, error: `Invalid profile folder: missing ${PROFILE_MANIFEST_FILENAME}` };
    }

    // Read and validate manifest
    const manifestData = fs.readFileSync(manifestPath, "utf-8");
    let manifest: FolderExportManifest;

    try {
      manifest = JSON.parse(manifestData);
    } catch {
      return { ok: false, error: "Invalid profile.json: not valid JSON" };
    }

    if (manifest.format !== PROFILE_EXPORT_FORMAT) {
      return { ok: false, error: "Invalid profile folder: wrong format" };
    }

    if (manifest.schemaVersion > CURRENT_PROFILE_SCHEMA_VERSION) {
      return { ok: false, error: "Profile export schema is newer than this launcher version." };
    }

    // Deserialize and resolve conflicts
    const profileData = deserializeProfile(manifest.profile);
    const index = await loadProfilesIndex();

    // Apply new name if provided
    if (newName) {
      profileData.name = newName;
    }

    const resolved = resolveProfileConflicts(profileData, index);

    // Persist the profile to index
    const profileId = await persistImportedProfile(resolved);
    const profileName = String(resolved.name);
    const sanitizedName = sanitizeName(profileName);

    // Apply profile root files (like mods.json)
    const profileDir = path.join(getProfilesDir(), sanitizedName);
    applyProfileFiles(profileDir, manifest.profileFiles ?? []);

    // Copy folders from import directory to template
    const templateDir = getProfileTemplateDir(sanitizedName);
    const foldersToImport = ["mods", "config", "resourcepacks", "shaderpacks"];

    for (const folder of foldersToImport) {
      const srcFolder = path.join(importDir, folder);
      const destFolder = path.join(templateDir, folder);

      if (fs.existsSync(srcFolder)) {
        // Clear destination and copy fresh
        if (fs.existsSync(destFolder)) {
          fs.rmSync(destFolder, { recursive: true, force: true });
        }
        copyDirectoryRecursive(srcFolder, destFolder);
      }
    }

    // Copy options.txt if exists
    const optionsPath = path.join(importDir, "options.txt");
    if (fs.existsSync(optionsPath)) {
      fs.copyFileSync(optionsPath, path.join(templateDir, "options.txt"));
    }

    return { ok: true, profileId, profileName };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Validate that a folder contains a valid profile export
 */
export function validateProfileFolder(folderPath: string): { valid: boolean; profileName?: string; error?: string } {
  try {
    const manifestPath = path.join(folderPath, PROFILE_MANIFEST_FILENAME);

    if (!fs.existsSync(manifestPath)) {
      return { valid: false, error: `Missing ${PROFILE_MANIFEST_FILENAME}` };
    }

    const manifestData = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestData) as FolderExportManifest;

    if (manifest.format !== PROFILE_EXPORT_FORMAT) {
      return { valid: false, error: "Invalid format" };
    }

    const profileName = typeof manifest.profile?.name === "string" ? manifest.profile.name : "Unknown";

    return { valid: true, profileName };
  } catch {
    return { valid: false, error: "Failed to read profile folder" };
  }
}
