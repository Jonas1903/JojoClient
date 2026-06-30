import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  Profile, 
  Installation, 
  ProfileExport, 
  InstallationExport, 
  ExportedFile 
} from '../types';
import {
  getProfileById,
  getProfileTemplateDir,
  getInstallationById,
  getInstallationDir,
  sanitizeName,
  createProfile,
  createInstallation,
  loadProfilesIndex,
  loadInstallationsIndex
} from './profiles';

const EXPORT_VERSION = 1;
const CLIENT_VERSION = '1.0.0';

// ============================================
// File Hashing
// ============================================

/**
 * Calculate SHA-256 hash of a file
 */
function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Collect files from a directory for export
 */
function collectFiles(dir: string, baseDir: string): ExportedFile[] {
  const files: ExportedFile[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const collectRecursive = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        collectRecursive(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const stats = fs.statSync(fullPath);
        
        files.push({
          path: relativePath,
          sha256: hashFile(fullPath),
          size: stats.size
        });
      }
    }
  };
  
  collectRecursive(dir);
  return files;
}

// ============================================
// Profile Export/Import
// ============================================

/**
 * Export a profile to a shareable format
 */
export async function exportProfile(profileId: string): Promise<ProfileExport> {
  const profile = await getProfileById(profileId);
  
  if (!profile) {
    throw new Error(`Profile with ID "${profileId}" not found`);
  }
  
  const templateDir = getProfileTemplateDir(sanitizeName(profile.name));
  
  // Collect all files from template
  const modsDir = path.join(templateDir, 'mods');
  const configDir = path.join(templateDir, 'config');
  const resourcepacksDir = path.join(templateDir, 'resourcepacks');
  const shaderpacksDir = path.join(templateDir, 'shaderpacks');
  const optionsPath = path.join(templateDir, 'options.txt');
  
  const exportData: ProfileExport = {
    exportVersion: EXPORT_VERSION,
    type: 'profile',
    profile: {
      name: profile.name,
      description: profile.description,
      icon: profile.icon,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    },
    mods: collectFiles(modsDir, modsDir),
    configs: collectFiles(configDir, configDir),
    resourcepacks: collectFiles(resourcepacksDir, resourcepacksDir),
    shaderpacks: collectFiles(shaderpacksDir, shaderpacksDir),
    options: fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf-8') : undefined,
    exportedAt: new Date().toISOString(),
    clientVersion: CLIENT_VERSION
  };
  
  return exportData;
}

/**
 * Export a profile with all file contents to a ZIP-like bundle
 * Returns a base64-encoded JSON with embedded file data
 */
export async function exportProfileBundle(profileId: string): Promise<string> {
  const profile = await getProfileById(profileId);
  
  if (!profile) {
    throw new Error(`Profile with ID "${profileId}" not found`);
  }
  
  const templateDir = getProfileTemplateDir(sanitizeName(profile.name));
  
  // Collect files with their contents
  const collectFilesWithContent = (dir: string): Array<{ path: string; content: string }> => {
    const result: Array<{ path: string; content: string }> = [];
    
    if (!fs.existsSync(dir)) return result;
    
    const collectRecursive = (currentDir: string, basePath: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
        
        if (entry.isDirectory()) {
          collectRecursive(fullPath, relativePath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          result.push({
            path: relativePath,
            content: content.toString('base64')
          });
        }
      }
    };
    
    collectRecursive(dir, '');
    return result;
  };
  
  const optionsPath = path.join(templateDir, 'options.txt');
  
  const bundle = {
    exportVersion: EXPORT_VERSION,
    type: 'profile-bundle' as const,
    profile: {
      name: profile.name,
      description: profile.description,
      icon: profile.icon
    },
    files: {
      mods: collectFilesWithContent(path.join(templateDir, 'mods')),
      config: collectFilesWithContent(path.join(templateDir, 'config')),
      resourcepacks: collectFilesWithContent(path.join(templateDir, 'resourcepacks')),
      shaderpacks: collectFilesWithContent(path.join(templateDir, 'shaderpacks'))
    },
    options: fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf-8') : undefined,
    exportedAt: new Date().toISOString(),
    clientVersion: CLIENT_VERSION
  };
  
  // Convert to JSON and base64 encode for easy sharing
  return Buffer.from(JSON.stringify(bundle)).toString('base64');
}

interface ProfileBundleData {
  type: string;
  profile: {
    name: string;
    description?: string;
    icon?: string;
  };
  files: {
    mods: Array<{ path: string; content: string }>;
    config: Array<{ path: string; content: string }>;
    resourcepacks: Array<{ path: string; content: string }>;
    shaderpacks: Array<{ path: string; content: string }>;
  };
  options?: string;
}

/**
 * Import a profile from a bundle
 */
export async function importProfileBundle(bundleData: string, newName?: string): Promise<Profile> {
  let bundle: ProfileBundleData;
  
  try {
    const jsonStr = Buffer.from(bundleData, 'base64').toString('utf-8');
    bundle = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Invalid profile bundle format');
  }
  
  if (bundle.type !== 'profile-bundle' || !bundle.profile) {
    throw new Error('Invalid profile bundle: missing required fields');
  }
  
  // Determine profile name
  let profileName = newName || bundle.profile.name;
  
  // Check for existing profile with same name and generate unique name
  const index = await loadProfilesIndex();
  const existingNames = Object.values(index.profiles).map(p => p.name.toLowerCase());
  let counter = 1;
  const baseName = profileName;
  while (existingNames.includes(profileName.toLowerCase())) {
    profileName = `${baseName} (${counter++})`;
  }
  
  // Create the profile
  const profile = await createProfile(
    profileName,
    bundle.profile.description
  );
  
  const templateDir = getProfileTemplateDir(sanitizeName(profileName));
  
  // Write files
  const writeFiles = (files: Array<{ path: string; content: string }>, baseDir: string) => {
    const resolvedBase = path.resolve(baseDir);
    for (const file of files) {
      const filePath = path.resolve(path.join(baseDir, file.path));
      if (!filePath.startsWith(resolvedBase + path.sep)) {
        throw new Error(`Path traversal blocked: "${file.path}" resolves outside the target directory`);
      }
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(file.content, 'base64'));
    }
  };
  
  if (bundle.files.mods) writeFiles(bundle.files.mods, path.join(templateDir, 'mods'));
  if (bundle.files.config) writeFiles(bundle.files.config, path.join(templateDir, 'config'));
  if (bundle.files.resourcepacks) writeFiles(bundle.files.resourcepacks, path.join(templateDir, 'resourcepacks'));
  if (bundle.files.shaderpacks) writeFiles(bundle.files.shaderpacks, path.join(templateDir, 'shaderpacks'));
  
  // Write options.txt
  if (bundle.options) {
    fs.writeFileSync(path.join(templateDir, 'options.txt'), bundle.options);
  }
  
  return profile;
}

// ============================================
// Installation Export/Import
// ============================================

/**
 * Export an installation to a shareable format
 */
export async function exportInstallation(installationId: string): Promise<InstallationExport> {
  const installationWithProfile = await getInstallationById(installationId);
  
  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${installationId}" not found`);
  }
  
  const { profileName, ...installation } = installationWithProfile;
  const installationDir = getInstallationDir(sanitizeName(profileName), sanitizeName(installation.name));
  
  // Get profile data
  const index = await loadProfilesIndex();
  const profile = Object.values(index.profiles).find(p => p.name === profileName);
  
  if (!profile) {
    throw new Error('Associated profile not found');
  }
  
  // Collect files
  const modsDir = path.join(installationDir, 'mods');
  const configDir = path.join(installationDir, 'config');
  const resourcepacksDir = path.join(installationDir, 'resourcepacks');
  const shaderpacksDir = path.join(installationDir, 'shaderpacks');
  const optionsPath = path.join(installationDir, 'options.txt');
  const serversPath = path.join(installationDir, 'servers.dat');
  
  const exportData: InstallationExport = {
    exportVersion: EXPORT_VERSION,
    type: 'installation',
    installation: {
      name: installation.name,
      minecraftVersion: installation.minecraftVersion,
      fabricLoaderVersion: installation.fabricLoaderVersion,
      matchesProfileVersion: installation.matchesProfileVersion,
      description: installation.description,
      createdAt: installation.createdAt
    },
    profileData: {
      name: profile.name,
      description: profile.description,
      icon: profile.icon,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    },
    mods: collectFiles(modsDir, modsDir),
    configs: collectFiles(configDir, configDir),
    resourcepacks: collectFiles(resourcepacksDir, resourcepacksDir),
    shaderpacks: collectFiles(shaderpacksDir, shaderpacksDir),
    options: fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf-8') : undefined,
    servers: fs.existsSync(serversPath) ? fs.readFileSync(serversPath).toString('base64') : undefined,
    exportedAt: new Date().toISOString(),
    clientVersion: CLIENT_VERSION
  };
  
  return exportData;
}

/**
 * Export an installation with all file contents as a shareable bundle
 */
export async function exportInstallationBundle(installationId: string): Promise<string> {
  const installationWithProfile = await getInstallationById(installationId);
  
  if (!installationWithProfile) {
    throw new Error(`Installation with ID "${installationId}" not found`);
  }
  
  const { profileName, ...installation } = installationWithProfile;
  const installationDir = getInstallationDir(sanitizeName(profileName), sanitizeName(installation.name));
  
  // Get profile data
  const index = await loadProfilesIndex();
  const profile = Object.values(index.profiles).find(p => p.name === profileName);
  
  // Collect files with content
  const collectFilesWithContent = (dir: string): Array<{ path: string; content: string }> => {
    const result: Array<{ path: string; content: string }> = [];
    
    if (!fs.existsSync(dir)) return result;
    
    const collectRecursive = (currentDir: string, basePath: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
        
        if (entry.isDirectory()) {
          collectRecursive(fullPath, relativePath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          result.push({
            path: relativePath,
            content: content.toString('base64')
          });
        }
      }
    };
    
    collectRecursive(dir, '');
    return result;
  };
  
  const optionsPath = path.join(installationDir, 'options.txt');
  const serversPath = path.join(installationDir, 'servers.dat');
  
  const bundle = {
    exportVersion: EXPORT_VERSION,
    type: 'installation-bundle' as const,
    installation: {
      name: installation.name,
      minecraftVersion: installation.minecraftVersion,
      fabricLoaderVersion: installation.fabricLoaderVersion,
      description: installation.description
    },
    profileData: profile ? {
      name: profile.name,
      description: profile.description
    } : null,
    files: {
      mods: collectFilesWithContent(path.join(installationDir, 'mods')),
      config: collectFilesWithContent(path.join(installationDir, 'config')),
      resourcepacks: collectFilesWithContent(path.join(installationDir, 'resourcepacks')),
      shaderpacks: collectFilesWithContent(path.join(installationDir, 'shaderpacks'))
    },
    options: fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf-8') : undefined,
    servers: fs.existsSync(serversPath) ? fs.readFileSync(serversPath).toString('base64') : undefined,
    exportedAt: new Date().toISOString(),
    clientVersion: CLIENT_VERSION
  };
  
  return Buffer.from(JSON.stringify(bundle)).toString('base64');
}

interface InstallationBundleData {
  type: string;
  installation: {
    name: string;
    minecraftVersion: string;
    fabricLoaderVersion: string;
    description?: string;
  };
  profileData: {
    name: string;
    description?: string;
  } | null;
  files: {
    mods: Array<{ path: string; content: string }>;
    config: Array<{ path: string; content: string }>;
    resourcepacks: Array<{ path: string; content: string }>;
    shaderpacks: Array<{ path: string; content: string }>;
  };
  options?: string;
  servers?: string;
}

/**
 * Import an installation from a bundle
 */
export async function importInstallationBundle(
  bundleData: string, 
  targetProfileId: string,
  newName?: string
): Promise<Installation> {
  let bundle: InstallationBundleData;
  
  try {
    const jsonStr = Buffer.from(bundleData, 'base64').toString('utf-8');
    bundle = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Invalid installation bundle format');
  }
  
  if (bundle.type !== 'installation-bundle' || !bundle.installation) {
    throw new Error('Invalid installation bundle: missing required fields');
  }
  
  // Verify target profile exists
  const index = await loadProfilesIndex();
  const targetProfile = index.profiles[targetProfileId];
  
  if (!targetProfile) {
    throw new Error('Target profile not found');
  }

  // Determine installation name
  let installationName = newName || bundle.installation.name;
  
  // Check for existing installation with same name and generate unique name
  const installationsIndex = await loadInstallationsIndex(sanitizeName(targetProfile.name));
  const existingNames = Object.values(installationsIndex.installations).map(i => i.name.toLowerCase());
  let counter = 1;
  const baseName = installationName;
  while (existingNames.includes(installationName.toLowerCase())) {
    installationName = `${baseName} (${counter++})`;
  }
  
  // Create the installation
  const { installation } = await createInstallation(
    targetProfileId,
    installationName,
    bundle.installation.minecraftVersion,
    bundle.installation.description
  );
  
  const installationDir = getInstallationDir(
    sanitizeName(targetProfile.name), 
    sanitizeName(installationName)
  );
  
  // Write files (overwrite what was copied from template)
  const writeFiles = (files: Array<{ path: string; content: string }>, baseDir: string) => {
    // Clear existing directory first
    if (fs.existsSync(baseDir)) {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
    fs.mkdirSync(baseDir, { recursive: true });

    const resolvedBase = path.resolve(baseDir);
    for (const file of files) {
      const filePath = path.resolve(path.join(baseDir, file.path));
      if (!filePath.startsWith(resolvedBase + path.sep)) {
        throw new Error(`Path traversal blocked: "${file.path}" resolves outside the target directory`);
      }
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(file.content, 'base64'));
    }
  };
  
  if (bundle.files.mods?.length > 0) writeFiles(bundle.files.mods, path.join(installationDir, 'mods'));
  if (bundle.files.config?.length > 0) writeFiles(bundle.files.config, path.join(installationDir, 'config'));
  if (bundle.files.resourcepacks?.length > 0) writeFiles(bundle.files.resourcepacks, path.join(installationDir, 'resourcepacks'));
  if (bundle.files.shaderpacks?.length > 0) writeFiles(bundle.files.shaderpacks, path.join(installationDir, 'shaderpacks'));
  
  // Write options.txt
  if (bundle.options) {
    fs.writeFileSync(path.join(installationDir, 'options.txt'), bundle.options);
  }
  
  // Write servers.dat
  if (bundle.servers) {
    fs.writeFileSync(path.join(installationDir, 'servers.dat'), Buffer.from(bundle.servers, 'base64'));
  }
  
  return installation;
}

/**
 * Save export bundle to a file
 */
export function saveBundleToFile(bundle: string, filePath: string): void {
  // Add .jojo extension if not present
  if (!filePath.endsWith('.jojo')) {
    filePath += '.jojo';
  }
  
  fs.writeFileSync(filePath, bundle);
}

/**
 * Load export bundle from a file
 */
export function loadBundleFromFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error('Bundle file not found');
  }
  
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Get bundle type without fully parsing
 */
export function getBundleType(bundleData: string): 'profile-bundle' | 'installation-bundle' | 'unknown' {
  try {
    const jsonStr = Buffer.from(bundleData, 'base64').toString('utf-8');
    const bundle = JSON.parse(jsonStr);
    if (bundle.type === 'profile-bundle') return 'profile-bundle';
    if (bundle.type === 'installation-bundle') return 'installation-bundle';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get bundle metadata without fully parsing
 */
export function getBundleMetadata(bundleData: string): {
  type: string;
  name: string;
  minecraftVersion: string;
  exportedAt: string;
  clientVersion: string;
} | null {
  try {
    const jsonStr = Buffer.from(bundleData, 'base64').toString('utf-8');
    const bundle = JSON.parse(jsonStr);
    
    const data = bundle.type === 'profile-bundle' ? bundle.profile : bundle.installation;
    
    return {
      type: bundle.type,
      name: data?.name || 'Unknown',
      minecraftVersion: data?.minecraftVersion || 'Unknown',
      exportedAt: bundle.exportedAt || 'Unknown',
      clientVersion: bundle.clientVersion || 'Unknown'
    };
  } catch {
    return null;
  }
}
