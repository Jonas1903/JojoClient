import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Profile, ProfilesIndex, InstallationsIndex, Installation } from '../types';
import { getBasePath } from '../utils/baseFolder';
import { getLatestFabricLoaderForMcVersion } from './versions';

// Generate UUID v4 without external dependency
function uuidv4(): string {
  return crypto.randomUUID();
}

const PROFILES_INDEX_VERSION = 1;
const INSTALLATIONS_INDEX_VERSION = 1;

// ============================================
// Template Config Version Tracking
// ============================================

interface TemplateConfigMeta {
  sourceVersion: string;  // MC version that last wrote configs
  lastUpdated: string;    // ISO timestamp
}

function getTemplateConfigMetaPath(profileName: string): string {
  return path.join(getProfileTemplateDir(sanitizeName(profileName)), ".config-meta.json");
}

function readTemplateConfigMeta(profileName: string): TemplateConfigMeta | null {
  const metaPath = getTemplateConfigMetaPath(profileName);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as TemplateConfigMeta;
  } catch {
    return null;
  }
}

function writeTemplateConfigMeta(profileName: string, mcVersion: string): void {
  const metaPath = getTemplateConfigMetaPath(profileName);
  const meta: TemplateConfigMeta = {
    sourceVersion: mcVersion,
    lastUpdated: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

// ============================================
// Path Helpers
// ============================================

export function getProfilesDir(): string {
  return path.join(getBasePath(), 'profiles');
}

export function getProfilesIndexPath(): string {
  return path.join(getProfilesDir(), 'index.json');
}

export function getProfileDir(profileName: string): string {
  return path.join(getProfilesDir(), sanitizeName(profileName));
}

export function getProfileTemplateDir(profileName: string): string {
  return path.join(getProfileDir(profileName), 'template');
}

export function getInstallationsDir(profileName: string): string {
  return path.join(getProfileDir(profileName), 'installations');
}

export function getInstallationsIndexPath(profileName: string): string {
  return path.join(getInstallationsDir(profileName), 'index.json');
}

export function getInstallationDir(profileName: string, installationName: string): string {
  return path.join(getInstallationsDir(profileName), sanitizeName(installationName));
}

/**
 * Sanitize a name for use as a folder name
 */
export function sanitizeName(name: string): string {
  // Replace invalid characters with underscores, trim, collapse multiple underscores
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/_+/g, '_');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function moveDirectorySafe(src: string, dest: string): Promise<void> {
  if (!fs.existsSync(src)) return;
  if (src === dest) return;

  const retryable = new Set(["EPERM", "EACCES", "EBUSY"]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.renameSync(src, dest);
      return;
    } catch (error) {
      const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code && retryable.has(code)) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  // Fallback: copy then remove
  copyDirectoryRecursive(src, dest);
  try {
    fs.rmSync(src, { recursive: true, force: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to move installation folder. Close Minecraft and try again. (${msg})`);
  }
}

// ============================================
// Index Management
// ============================================

/**
 * Load the profiles index, creating it if it doesn't exist
 */
export async function loadProfilesIndex(): Promise<ProfilesIndex> {
  const indexPath = getProfilesIndexPath();
  
  if (fs.existsSync(indexPath)) {
    const data = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(data) as ProfilesIndex;
    return parsed;
  }
  
  const index: ProfilesIndex = {
    version: PROFILES_INDEX_VERSION,
    profiles: {}
  };
  
  await saveProfilesIndex(index);
  return index;
}

/**
 * Save the profiles index
 */
export async function saveProfilesIndex(index: ProfilesIndex): Promise<void> {
  const indexPath = getProfilesIndexPath();
  const dir = path.dirname(indexPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

/**
 * Load installations index for a profile
 */
export async function loadInstallationsIndex(profileName: string): Promise<InstallationsIndex> {
  const indexPath = getInstallationsIndexPath(profileName);
  const profile = await getProfileByName(profileName);
  
  if (!profile) {
    throw new Error(`Profile "${profileName}" not found`);
  }
  
  if (fs.existsSync(indexPath)) {
    const data = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(data) as InstallationsIndex;
    return parsed;
  }
  
  // Create empty index
  const index: InstallationsIndex = {
    version: INSTALLATIONS_INDEX_VERSION,
    profileId: profile.id,
    installations: {}
  };
  
  await saveInstallationsIndex(profileName, index);
  return index;
}

/**
 * Save installations index for a profile
 */
export async function saveInstallationsIndex(profileName: string, index: InstallationsIndex): Promise<void> {
  const indexPath = getInstallationsIndexPath(profileName);
  const dir = path.dirname(indexPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

// ============================================
// Profile CRUD Operations
// ============================================


/**
 * Get all profiles
 */
export async function getAllProfiles(): Promise<Profile[]> {
  const index = await loadProfilesIndex();
  return Object.values(index.profiles);
}

/**
 * Get a profile by name
 */
export async function getProfileByName(name: string): Promise<Profile | null> {
  const index = await loadProfilesIndex();
  return Object.values(index.profiles).find(p => p.name === name) || null;
}

/**
 * Get a profile by ID
 */
export async function getProfileById(id: string): Promise<Profile | null> {
  const index = await loadProfilesIndex();
  return index.profiles[id] || null;
}

/**
 * Create a new profile
 */
export async function createProfile(
  name: string,
  description?: string
): Promise<Profile> {
  const index = await loadProfilesIndex();
  
  // Check for duplicate name
  const existingNames = Object.values(index.profiles)
    .filter((p) => !p.isDefault)
    .map(p => p.name.toLowerCase());
  if (existingNames.includes(name.toLowerCase())) {
    throw new Error(`A profile with name "${name}" already exists`);
  }
  
  const sanitized = sanitizeName(name);
  if (!sanitized) {
    throw new Error('Invalid profile name');
  }
  
  const now = new Date().toISOString();
  
  const profile: Profile = {
    id: uuidv4(),
    name: name,
    description,
    createdAt: now,
    updatedAt: now
  };
  
  // Create profile directories
  const templateDir = getProfileTemplateDir(sanitized);
  const installationsDir = getInstallationsDir(sanitized);
  
  fs.mkdirSync(templateDir, { recursive: true });
  fs.mkdirSync(path.join(templateDir, 'mods'), { recursive: true });
  fs.mkdirSync(path.join(templateDir, 'config'), { recursive: true });
  fs.mkdirSync(path.join(templateDir, 'resourcepacks'), { recursive: true });
  fs.mkdirSync(path.join(templateDir, 'shaderpacks'), { recursive: true });
  fs.mkdirSync(installationsDir, { recursive: true });
  
  // Create empty installations index
  const installationsIndex: InstallationsIndex = {
    version: INSTALLATIONS_INDEX_VERSION,
    profileId: profile.id,
    installations: {}
  };
  await saveInstallationsIndex(sanitized, installationsIndex);
  
  // Add to profiles index
  index.profiles[profile.id] = profile;
  await saveProfilesIndex(index);

  return profile;
}

/**
 * Update a profile
 */
export async function updateProfile(
  id: string,
  updates: Partial<Pick<Profile, 'name' | 'description' | 'icon'>>
): Promise<Profile> {
  const index = await loadProfilesIndex();
  const profile = index.profiles[id];
  
  if (!profile) {
    throw new Error(`Profile with ID "${id}" not found`);
  }
  
  // Check for duplicate name
  if (updates.name && updates.name !== profile.name) {
    const existingNames = Object.values(index.profiles)
      .filter(p => p.id !== id && !p.isDefault)
      .map(p => p.name.toLowerCase());
    if (existingNames.includes(updates.name.toLowerCase())) {
      throw new Error(`A profile with name "${updates.name}" already exists`);
    }
    
    // Rename folder
    const oldDir = getProfileDir(sanitizeName(profile.name));
    const newDir = getProfileDir(sanitizeName(updates.name));
    if (fs.existsSync(oldDir) && oldDir !== newDir) {
      fs.renameSync(oldDir, newDir);
    }
  }
  
  // Apply updates
  const updatedProfile: Profile = {
    ...profile,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  index.profiles[id] = updatedProfile;
  await saveProfilesIndex(index);
  
  return updatedProfile;
}

/**
 * Delete a profile and its installations
 */
export async function deleteProfile(id: string): Promise<{ movedInstallations: string[] }> {
  const index = await loadProfilesIndex();
  const profile = index.profiles[id];
  
  if (!profile) {
    throw new Error(`Profile with ID "${id}" not found`);
  }

  const allProfiles = Object.values(index.profiles);

  if (allProfiles.length <= 1) {
    throw new Error("Cannot delete the last remaining profile.");
  }

  if (profile.isDefault) {
    throw new Error("Default profile cannot be deleted.");
  }

  const targetPool = allProfiles.filter((p) => p.id !== id);
  const preferredTargets = targetPool.filter((p) => !p.isDefault);
  const selectionPool = preferredTargets.length > 0 ? preferredTargets : targetPool;
  const targetProfile = selectionPool
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

  if (!targetProfile) {
    throw new Error("No target profile available to move installations.");
  }
  
  const movedInstallations: string[] = [];

  const installationsIndex = await loadInstallationsIndex(sanitizeName(profile.name));
  for (const installation of Object.values(installationsIndex.installations)) {
    await moveInstallation(installation.id, targetProfile.id);
    movedInstallations.push(installation.id);
  }

  // Delete profile folder (should be empty after moves)
  const profileDir = getProfileDir(sanitizeName(profile.name));
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  
  // Remove from index
  delete index.profiles[id];
  await saveProfilesIndex(index);
  
  return { movedInstallations };
}

// ============================================
// Installation CRUD Operations
// ============================================

/**
 * Get all installations across all profiles
 */
export async function getAllInstallations(): Promise<Array<Installation & { profileName: string }>> {
  const profiles = await getAllProfiles();
  const allInstallations: Array<Installation & { profileName: string }> = [];
  
  for (const profile of profiles) {
    const installationsIndex = await loadInstallationsIndex(sanitizeName(profile.name));
    for (const installation of Object.values(installationsIndex.installations)) {
      allInstallations.push({
        ...installation,
        profileName: profile.name
      });
    }
  }
  
  return allInstallations;
}

/**
 * Get installations for a specific profile
 */
export async function getInstallationsByProfile(profileName: string): Promise<Installation[]> {
  const installationsIndex = await loadInstallationsIndex(sanitizeName(profileName));
  return Object.values(installationsIndex.installations);
}

/**
 * Get an installation by ID
 */
export async function getInstallationById(id: string): Promise<(Installation & { profileName: string }) | null> {
  const profiles = await getAllProfiles();
  
  for (const profile of profiles) {
    const installationsIndex = await loadInstallationsIndex(sanitizeName(profile.name));
    const installation = installationsIndex.installations[id];
    if (installation) {
      return { ...installation, profileName: profile.name };
    }
  }
  
  return null;
}

/**
 * Create a new installation from a profile
 */
export async function createInstallation(
  profileId: string,
  name: string,
  minecraftVersion: string,
  description?: string
): Promise<{ installation: Installation }> {
  const index = await loadProfilesIndex();
  const profile = index.profiles[profileId];
  
  if (!profile) {
    throw new Error(`Profile with ID "${profileId}" not found`);
  }
  
  const profileName = sanitizeName(profile.name);
  const installationsIndex = await loadInstallationsIndex(profileName);
  
  // Check for duplicate name within profile
  const existingNames = Object.values(installationsIndex.installations)
    .map(i => i.name.toLowerCase());
  if (existingNames.includes(name.toLowerCase())) {
    throw new Error(`An installation with name "${name}" already exists in profile "${profile.name}"`);
  }
  
  const sanitizedName = sanitizeName(name);
  if (!sanitizedName) {
    throw new Error('Invalid installation name');
  }
  
  const now = new Date().toISOString();
  
  if (!minecraftVersion) {
    throw new Error("Minecraft version is required to create an installation");
  }

  const targetMcVersion = minecraftVersion;
  const targetFabricVersion = (await getLatestFabricLoaderForMcVersion(targetMcVersion)) || '0.15.7';

  const installation: Installation = {
    id: uuidv4(),
    name: name,
    profileId: profileId,
    minecraftVersion: targetMcVersion,
    fabricLoaderVersion: targetFabricVersion,
    matchesProfileVersion: true,
    description,
    createdAt: now,
    playtimeSeconds: 0
  };
  
  // Create installation directory
  const installationDir = getInstallationDir(profileName, sanitizedName);
  fs.mkdirSync(installationDir, { recursive: true });
  
  // Copy template files to installation
  const templateDir = getProfileTemplateDir(profileName);
  await copyTemplateToInstallation(templateDir, installationDir);
  
  // Create additional directories for game data
  fs.mkdirSync(path.join(installationDir, 'saves'), { recursive: true });
  fs.mkdirSync(path.join(installationDir, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(installationDir, 'logs'), { recursive: true });
  
  // Add to installations index
  installationsIndex.installations[installation.id] = installation;
  await saveInstallationsIndex(profileName, installationsIndex);

  return { installation };
}

/**
 * Copy template directory contents to installation
 */
async function copyTemplateToInstallation(templateDir: string, installationDir: string): Promise<void> {
  if (!fs.existsSync(templateDir)) {
    return;
  }
  
  const copyRecursive = (src: string, dest: string) => {
    if (!fs.existsSync(src)) return;
    
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src);
      for (const entry of entries) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  };
  
  copyRecursive(templateDir, installationDir);
}

/**
 * Update an installation
 */
export async function updateInstallation(
  id: string,
  updates: Partial<Pick<Installation, 'name' | 'description' | 'lastPlayedAt' | 'playtimeSeconds'>>
): Promise<Installation> {
  const installationWithProfile = await getInstallationById(id);
  
  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${id}" not found`);
  }
  
  const { profileName, ...installation } = installationWithProfile;
  const sanitizedProfileName = sanitizeName(profileName);
  const installationsIndex = await loadInstallationsIndex(sanitizedProfileName);
  
  // Check for duplicate name
  if (updates.name && updates.name !== installation.name) {
    const existingNames = Object.values(installationsIndex.installations)
      .filter(i => i.id !== id)
      .map(i => i.name.toLowerCase());
    if (existingNames.includes(updates.name.toLowerCase())) {
      throw new Error(`An installation with name "${updates.name}" already exists in this profile`);
    }
    
    // Rename folder
    const oldDir = getInstallationDir(sanitizedProfileName, sanitizeName(installation.name));
    const newDir = getInstallationDir(sanitizedProfileName, sanitizeName(updates.name));
    if (fs.existsSync(oldDir) && oldDir !== newDir) {
      fs.renameSync(oldDir, newDir);
    }
  }
  
  // Apply updates
  const updatedInstallation: Installation = {
    ...installation,
    ...updates
  };
  
  installationsIndex.installations[id] = updatedInstallation;
  await saveInstallationsIndex(sanitizedProfileName, installationsIndex);
  
  return updatedInstallation;
}

/**
 * Delete an installation
 */
export async function deleteInstallation(id: string): Promise<void> {
  const installationWithProfile = await getInstallationById(id);
  
  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${id}" not found`);
  }
  
  const { profileName, ...installation } = installationWithProfile;
  const sanitizedProfileName = sanitizeName(profileName);
  
  // Delete installation folder
  const installationDir = getInstallationDir(sanitizedProfileName, sanitizeName(installation.name));
  if (fs.existsSync(installationDir)) {
    fs.rmSync(installationDir, { recursive: true, force: true });
  }
  
  // Remove from index
  const installationsIndex = await loadInstallationsIndex(sanitizedProfileName);
  delete installationsIndex.installations[id];
  await saveInstallationsIndex(sanitizedProfileName, installationsIndex);
}

/**
 * Move an installation to a different profile
 */
export async function moveInstallation(
  installationId: string,
  targetProfileId: string
): Promise<Installation> {
  const installationWithProfile = await getInstallationById(installationId);
  
  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${installationId}" not found`);
  }
  
  const { profileName: sourceProfileName, ...installation } = installationWithProfile;
  
  const index = await loadProfilesIndex();
  const targetProfile = index.profiles[targetProfileId];
  
  if (!targetProfile) {
    throw new Error(`Target profile with ID "${targetProfileId}" not found`);
  }
  
  if (installation.profileId === targetProfileId) {
    return installation; // Already in target profile
  }
  
  const sourceSanitized = sanitizeName(sourceProfileName);
  const targetSanitized = sanitizeName(targetProfile.name);
  
  // Check for name collision in target profile
  const targetInstallationsIndex = await loadInstallationsIndex(targetSanitized);
  let newName = installation.name;
  const existingNames = Object.values(targetInstallationsIndex.installations)
    .map(i => i.name.toLowerCase());
  let counter = 1;
  while (existingNames.includes(newName.toLowerCase())) {
    newName = `${installation.name} (${counter++})`;
  }
  
  // Move folder
  const oldPath = getInstallationDir(sourceSanitized, sanitizeName(installation.name));
  const newPath = getInstallationDir(targetSanitized, sanitizeName(newName));
  
  if (fs.existsSync(oldPath)) {
    await moveDirectorySafe(oldPath, newPath);
  }
  
  // Remove from source index
  const sourceInstallationsIndex = await loadInstallationsIndex(sourceSanitized);
  delete sourceInstallationsIndex.installations[installationId];
  await saveInstallationsIndex(sourceSanitized, sourceInstallationsIndex);
  
  // Add to target index
  const movedInstallation: Installation = {
    ...installation,
    name: newName,
    profileId: targetProfileId,
    matchesProfileVersion: true
  };
  
  targetInstallationsIndex.installations[installationId] = movedInstallation;
  await saveInstallationsIndex(targetSanitized, targetInstallationsIndex);

  // Always sync target profile template into the moved installation
  const templateDir = getProfileTemplateDir(targetSanitized);
  const installationDir = getInstallationDir(targetSanitized, sanitizeName(newName));
  const foldersToSync = ['mods', 'config', 'resourcepacks', 'shaderpacks'];

  for (const folder of foldersToSync) {
    const srcFolder = path.join(templateDir, folder);
    const destFolder = path.join(installationDir, folder);

    if (fs.existsSync(srcFolder)) {
      if (fs.existsSync(destFolder)) {
        fs.rmSync(destFolder, { recursive: true, force: true });
      }
      await copyTemplateToInstallation(srcFolder, destFolder);
    }
  }

  const srcOptions = path.join(templateDir, 'options.txt');
  const destOptions = path.join(installationDir, 'options.txt');
  if (fs.existsSync(srcOptions)) {
    fs.copyFileSync(srcOptions, destOptions);
  }

  // Sync profile mods list to the moved installation
  const mods = await import("./mods");
  await mods.syncProfileModsToInstallation(targetProfileId, installationId);
  
  return movedInstallation;
}

// ============================================
// Template Sync
// ============================================

type SettingsBundle = {
  t: "s";
  v: number;
  o?: string;
};

const SETTINGS_BUNDLE_VERSION = 1;

/**
 * Sync template changes to an installation (only if it matches profile version)
 */
export async function syncTemplateToInstallation(installationId: string): Promise<boolean> {
  const installationWithProfile = await getInstallationById(installationId);
  
  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${installationId}" not found`);
  }
  
  const { profileName, ...installation } = installationWithProfile;
  const sanitizedProfileName = sanitizeName(profileName);
  const templateDir = getProfileTemplateDir(sanitizedProfileName);
  const installationDir = getInstallationDir(sanitizedProfileName, sanitizeName(installation.name));
  
  // Sync mods, config, resourcepacks, shaderpacks, and options.txt
  const foldersToSync = ['mods', 'config', 'resourcepacks', 'shaderpacks'];
  
  for (const folder of foldersToSync) {
    const srcFolder = path.join(templateDir, folder);
    const destFolder = path.join(installationDir, folder);
    
    if (fs.existsSync(srcFolder)) {
      // Clear destination and copy fresh
      if (fs.existsSync(destFolder)) {
        fs.rmSync(destFolder, { recursive: true, force: true });
      }
      await copyTemplateToInstallation(srcFolder, destFolder);
    }
  }
  
  // Sync options.txt
  const srcOptions = path.join(templateDir, 'options.txt');
  const destOptions = path.join(installationDir, 'options.txt');
  if (fs.existsSync(srcOptions)) {
    fs.copyFileSync(srcOptions, destOptions);
  }
  
  return true;
}

/**
 * Sync settings (options.txt) and config folder from template to installation.
 * Only syncs config if versions are compatible.
 */
export async function syncTemplateSettingsToInstallation(installationId: string): Promise<{
  success: boolean;
  configSynced: boolean;
  optionsSynced: boolean;
  resourcepacksSynced: boolean;
  shaderpacksSynced: boolean;
  versionMismatch: boolean;
}> {
  const installationWithProfile = await getInstallationById(installationId);

  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${installationId}" not found`);
  }

  const { profileName, ...installation } = installationWithProfile;
  const sanitizedProfileName = sanitizeName(profileName);
  const templateDir = getProfileTemplateDir(sanitizedProfileName);
  const installationDir = getInstallationDir(sanitizedProfileName, sanitizeName(installation.name));
  
  let configSynced = false;
  let optionsSynced = false;
  let resourcepacksSynced = false;
  let shaderpacksSynced = false;
  let versionMismatch = false;

  // Always sync options.txt (not version-specific)
  const srcOptions = path.join(templateDir, "options.txt");
  const destOptions = path.join(installationDir, "options.txt");
  if (fs.existsSync(srcOptions)) {
    fs.mkdirSync(path.dirname(destOptions), { recursive: true });
    fs.copyFileSync(srcOptions, destOptions);
    optionsSynced = true;
  }

  // Sync resourcepacks from template to installation (always, not version-specific)
  // Uses merge approach: copy all from template, installation keeps any extras it has
  const srcResourcepacks = path.join(templateDir, "resourcepacks");
  const destResourcepacks = path.join(installationDir, "resourcepacks");
  if (fs.existsSync(srcResourcepacks)) {
    fs.mkdirSync(destResourcepacks, { recursive: true });
    const templatePacks = fs.readdirSync(srcResourcepacks);
    for (const pack of templatePacks) {
      const srcPack = path.join(srcResourcepacks, pack);
      const destPack = path.join(destResourcepacks, pack);
      // Only copy if doesn't exist in installation (don't overwrite user changes)
      if (!fs.existsSync(destPack)) {
        if (fs.statSync(srcPack).isDirectory()) {
          copyDirectoryRecursive(srcPack, destPack);
        } else {
          fs.copyFileSync(srcPack, destPack);
        }
      }
    }
    resourcepacksSynced = true;
  }

  // Sync shaderpacks from template to installation (always, not version-specific)
  const srcShaderpacks = path.join(templateDir, "shaderpacks");
  const destShaderpacks = path.join(installationDir, "shaderpacks");
  if (fs.existsSync(srcShaderpacks)) {
    fs.mkdirSync(destShaderpacks, { recursive: true });
    const templateShaders = fs.readdirSync(srcShaderpacks);
    for (const shader of templateShaders) {
      const srcShader = path.join(srcShaderpacks, shader);
      const destShader = path.join(destShaderpacks, shader);
      // Only copy if doesn't exist in installation
      if (!fs.existsSync(destShader)) {
        if (fs.statSync(srcShader).isDirectory()) {
          copyDirectoryRecursive(srcShader, destShader);
        } else {
          fs.copyFileSync(srcShader, destShader);
        }
      }
    }
    shaderpacksSynced = true;
  }

  // Check version compatibility for config sync
  const templateMeta = readTemplateConfigMeta(profileName);
  const installationVersion = installation.minecraftVersion;
  
  // Sync config if:
  // 1. Template has no version yet (use whatever is there)
  // 2. Installation version matches template version
  // 3. Versions are compatible (same major.minor)
  const shouldSyncConfig = !templateMeta || 
    templateMeta.sourceVersion === installationVersion ||
    areMcVersionsCompatible(templateMeta.sourceVersion, installationVersion);

  const srcConfig = path.join(templateDir, "config");
  const destConfig = path.join(installationDir, "config");
  
  if (shouldSyncConfig && fs.existsSync(srcConfig)) {
    // Clear destination config and copy fresh from template
    if (fs.existsSync(destConfig)) {
      fs.rmSync(destConfig, { recursive: true, force: true });
    }
    copyDirectoryRecursive(srcConfig, destConfig);
    configSynced = true;
  } else if (!shouldSyncConfig) {
    versionMismatch = true;
    console.log(`⚠️ Skipping config sync to installation: template is ${templateMeta?.sourceVersion}, installation is ${installationVersion}`);
  }

  return { success: true, configSynced, optionsSynced, resourcepacksSynced, shaderpacksSynced, versionMismatch };
}

/**
 * Update the profile template from an installation (only if it matches profile version)
 */
export async function updateTemplateFromInstallation(installationId: string): Promise<boolean> {
  const installationWithProfile = await getInstallationById(installationId);
  
  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${installationId}" not found`);
  }
  
  const { profileName, ...installation } = installationWithProfile;
  const sanitizedProfileName = sanitizeName(profileName);
  const templateDir = getProfileTemplateDir(sanitizedProfileName);
  const installationDir = getInstallationDir(sanitizedProfileName, sanitizeName(installation.name));
  
  // Sync mods, config, resourcepacks, shaderpacks from installation to template
  const foldersToSync = ['mods', 'config', 'resourcepacks', 'shaderpacks'];
  
  for (const folder of foldersToSync) {
    const srcFolder = path.join(installationDir, folder);
    const destFolder = path.join(templateDir, folder);
    
    if (fs.existsSync(srcFolder)) {
      // Clear destination and copy fresh
      if (fs.existsSync(destFolder)) {
        fs.rmSync(destFolder, { recursive: true, force: true });
      }
      await copyTemplateToInstallation(srcFolder, destFolder);
    }
  }
  
  // Sync options.txt
  const srcOptions = path.join(installationDir, 'options.txt');
  const destOptions = path.join(templateDir, 'options.txt');
  if (fs.existsSync(srcOptions)) {
    fs.copyFileSync(srcOptions, destOptions);
  }
  
  // Update profile timestamp
  const index = await loadProfilesIndex();
  const profile = Object.values(index.profiles).find(p => p.name === profileName);
  if (profile) {
    profile.updatedAt = new Date().toISOString();
    await saveProfilesIndex(index);
  }
  
  return true;
}

/**
 * Update settings (options.txt) and config folder in template from installation.
 * Version-aware: Only syncs config if MC version matches or if template has no version yet.
 * Returns info about what was synced.
 */
export async function updateTemplateSettingsFromInstallation(installationId: string): Promise<{
  success: boolean;
  configSynced: boolean;
  optionsSynced: boolean;
  resourcepacksSynced: boolean;
  shaderpacksSynced: boolean;
  versionMismatch: boolean;
  reason?: string;
}> {
  const installationWithProfile = await getInstallationById(installationId);

  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${installationId}" not found`);
  }

  const { profileName, ...installation } = installationWithProfile;
  const sanitizedProfileName = sanitizeName(profileName);
  const templateDir = getProfileTemplateDir(sanitizedProfileName);
  const installationDir = getInstallationDir(sanitizedProfileName, sanitizeName(installation.name));
  
  let configSynced = false;
  let optionsSynced = false;
  let resourcepacksSynced = false;
  let shaderpacksSynced = false;
  let versionMismatch = false;

  // Always sync options.txt (not version-specific)
  const srcOptions = path.join(installationDir, "options.txt");
  const destOptions = path.join(templateDir, "options.txt");
  if (fs.existsSync(srcOptions)) {
    fs.mkdirSync(path.dirname(destOptions), { recursive: true });
    fs.copyFileSync(srcOptions, destOptions);
    optionsSynced = true;
  }

  // Merge resourcepacks from installation to template (add new ones, don't remove existing)
  const srcResourcepacks = path.join(installationDir, "resourcepacks");
  const destResourcepacks = path.join(templateDir, "resourcepacks");
  if (fs.existsSync(srcResourcepacks)) {
    fs.mkdirSync(destResourcepacks, { recursive: true });
    const installationPacks = fs.readdirSync(srcResourcepacks);
    for (const pack of installationPacks) {
      const srcPack = path.join(srcResourcepacks, pack);
      const destPack = path.join(destResourcepacks, pack);
      // Only copy if doesn't exist in template (merge approach - never remove from template)
      if (!fs.existsSync(destPack)) {
        if (fs.statSync(srcPack).isDirectory()) {
          copyDirectoryRecursive(srcPack, destPack);
        } else {
          fs.copyFileSync(srcPack, destPack);
        }
        resourcepacksSynced = true;
      }
    }
  }

  // Merge shaderpacks from installation to template (add new ones, don't remove existing)
  const srcShaderpacks = path.join(installationDir, "shaderpacks");
  const destShaderpacks = path.join(templateDir, "shaderpacks");
  if (fs.existsSync(srcShaderpacks)) {
    fs.mkdirSync(destShaderpacks, { recursive: true });
    const installationShaders = fs.readdirSync(srcShaderpacks);
    for (const shader of installationShaders) {
      const srcShader = path.join(srcShaderpacks, shader);
      const destShader = path.join(destShaderpacks, shader);
      // Only copy if doesn't exist in template (merge approach)
      if (!fs.existsSync(destShader)) {
        if (fs.statSync(srcShader).isDirectory()) {
          copyDirectoryRecursive(srcShader, destShader);
        } else {
          fs.copyFileSync(srcShader, destShader);
        }
        shaderpacksSynced = true;
      }
    }
  }

  // Check version compatibility for config sync
  const templateMeta = readTemplateConfigMeta(profileName);
  const installationVersion = installation.minecraftVersion;
  
  // Sync config if:
  // 1. Template has no version yet (first time)
  // 2. Installation version matches template version
  // 3. Installation version is "compatible" (same major.minor, e.g., 1.20.1 and 1.20.4)
  const shouldSyncConfig = !templateMeta || 
    templateMeta.sourceVersion === installationVersion ||
    areMcVersionsCompatible(templateMeta.sourceVersion, installationVersion);

  const srcConfig = path.join(installationDir, "config");
  const destConfig = path.join(templateDir, "config");
  
  if (shouldSyncConfig) {
    if (fs.existsSync(srcConfig)) {
      // Clear destination config and copy fresh from installation
      if (fs.existsSync(destConfig)) {
        fs.rmSync(destConfig, { recursive: true, force: true });
      }
      copyDirectoryRecursive(srcConfig, destConfig);
      writeTemplateConfigMeta(profileName, installationVersion);
      configSynced = true;
    }
  } else {
    versionMismatch = true;
    console.log(`⚠️ Skipping config sync: template is ${templateMeta?.sourceVersion}, installation is ${installationVersion}`);
  }

  const index = await loadProfilesIndex();
  const profile = Object.values(index.profiles).find((p) => p.name === profileName);
  if (profile) {
    profile.updatedAt = new Date().toISOString();
    await saveProfilesIndex(index);
  }

  return { 
    success: true, 
    configSynced, 
    optionsSynced, 
    resourcepacksSynced,
    shaderpacksSynced,
    versionMismatch,
    reason: versionMismatch ? `Template version (${templateMeta?.sourceVersion}) differs from installation (${installationVersion})` : undefined
  };
}

/**
 * Check if two MC versions are "compatible" for config sharing.
 * Versions are compatible if they share the same major.minor (e.g., 1.20.x)
 */
function areMcVersionsCompatible(version1: string, version2: string): boolean {
  const parts1 = version1.split(".");
  const parts2 = version2.split(".");
  
  // Compare major and minor version
  if (parts1[0] !== parts2[0]) return false;
  if (parts1[1] !== parts2[1]) return false;
  
  return true;
}

export async function exportProfileSettingsBundle(profileId: string): Promise<string> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");

  const templateDir = getProfileTemplateDir(sanitizeName(profile.name));
  const optionsPath = path.join(templateDir, "options.txt");
  const options = fs.existsSync(optionsPath)
    ? fs.readFileSync(optionsPath).toString("base64")
    : undefined;

  const bundle: SettingsBundle = {
    t: "s",
    v: SETTINGS_BUNDLE_VERSION,
    o: options,
  };

  return Buffer.from(JSON.stringify(bundle)).toString("base64");
}

export async function importProfileSettingsBundle(
  profileId: string,
  bundleData: string
): Promise<{ applied: boolean; reason?: string }> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");

  let bundle: SettingsBundle;
  try {
    const jsonStr = Buffer.from(bundleData, "base64").toString("utf-8");
    bundle = JSON.parse(jsonStr) as SettingsBundle;
  } catch {
    throw new Error("Invalid settings bundle data");
  }

  if (bundle?.t !== "s") {
    throw new Error("Unsupported settings bundle format");
  }

  if (!bundle.o) {
    return { applied: false, reason: "No settings found" };
  }

  const templateDir = getProfileTemplateDir(sanitizeName(profile.name));
  const optionsPath = path.join(templateDir, "options.txt");
  fs.mkdirSync(path.dirname(optionsPath), { recursive: true });
  fs.writeFileSync(optionsPath, Buffer.from(bundle.o, "base64"));
  return { applied: true };
}
