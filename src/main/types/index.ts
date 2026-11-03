// ============================================
// JojoClient Data Types
// Shared between the Electron main process and the React renderer.
// Renderer must use `import type` to avoid bundling main-only code.
// ============================================

/**
 * Mod issue tracking - records failed mod downloads/installations
 */
export interface ModIssue {
  slug: string;
  modName: string;
  error: string;
  details?: string;
  timestamp: number;
}

/**
 * A mod entry inside a profile or installation.
 */
export interface Mod {
  id: string;
  name: string;
  filename: string;
  version: string;
  enabled: boolean;
  mcVersion?: string;
  slug?: string;
  iconUrl?: string | null;
  isBundled?: boolean;
}

/**
 * Search result entry from the Modrinth API.
 */
export interface ModrinthMod {
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  icon_url: string;
  versions: string[];
}

/**
 * A Profile defines a reusable configuration template that can be applied to installations.
 * Profiles contain mods, configs, and settings that get copied to each installation.
 */
export interface Profile {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name - unique across all profiles */
  name: string;
  /** Optional description */
  description?: string;
  /** Icon name or path (for future use) */
  icon?: string;
  /** When the profile was created */
  createdAt: string;
  /** When the profile was last modified */
  updatedAt: string;
  /** Legacy flag from older data (no default profile is created anymore) */
  isDefault?: boolean;
}

/**
 * An Installation is a runnable instance of Minecraft with a specific profile's configuration.
 * Each installation has its own isolated game directory.
 */
export interface Installation {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name - unique within the parent profile */
  name: string;
  /** ID of the profile this installation belongs to */
  profileId: string;
  /** Minecraft version for this installation (copied from profile at creation, can differ) */
  minecraftVersion: string;
  /** Fabric loader version for this installation */
  fabricLoaderVersion: string;
  /** Whether this installation was created from the original profile version (for template sync) */
  matchesProfileVersion: boolean;
  /** Optional description */
  description?: string;
  /** When the installation was created */
  createdAt: string;
  /** When the installation was last launched */
  lastPlayedAt?: string;
  /** Total playtime in seconds */
  playtimeSeconds: number;
  /** Mod issues encountered during installation creation/sync */
  modIssues?: ModIssue[];
}

/**
 * Installation augmented with the parent profile's display name. This is what
 * `getAllInstallations` / `getInstallationById` return and what the renderer
 * consumes.
 */
export type InstallationWithProfile = Installation & { profileName: string };

/**
 * Index file stored at profiles/index.json
 * Contains metadata about all profiles
 */
export interface ProfilesIndex {
  /** Schema version for future migrations */
  version: number;
  /** All profiles keyed by ID */
  profiles: Record<string, Profile>;
}

/**
 * Index file stored at profiles/<profileName>/installations/index.json
 * Contains metadata about all installations within a profile
 */
export interface InstallationsIndex {
  /** Schema version for future migrations */
  version: number;
  /** Profile ID this index belongs to */
  profileId: string;
  /** All installations keyed by ID */
  installations: Record<string, Installation>;
}

/**
 * File entry used in export bundles
 */
export interface ExportedFile {
  /** Relative path inside the export */
  path: string;
  /** SHA-256 hash */
  sha256: string;
  /** File size in bytes */
  size: number;
}

/**
 * Export package format for sharing profiles with other users
 */
export interface ProfileExport {
  /** Export format version */
  exportVersion: number;
  /** Type of export */
  type: 'profile';
  /** Profile metadata */
  profile: Omit<Profile, 'id' | 'isDefault'>;
  /** List of mods */
  mods: ExportedFile[];
  /** List of config files */
  configs: ExportedFile[];
  /** Resource packs */
  resourcepacks: ExportedFile[];
  /** Shader packs */
  shaderpacks: ExportedFile[];
  /** Options.txt content */
  options?: string;
  /** Export timestamp */
  exportedAt: string;
  /** JojoClient version */
  clientVersion: string;
}

/**
 * Export package format for sharing installations with other users
 */
export interface InstallationExport {
  /** Export format version */
  exportVersion: number;
  /** Type of export */
  type: 'installation';
  /** Installation metadata */
  installation: Omit<Installation, 'id' | 'profileId' | 'lastPlayedAt' | 'playtimeSeconds'>;
  /** Embedded profile data or reference */
  profileData: Omit<Profile, 'id' | 'isDefault'>;
  /** List of mods */
  mods: ExportedFile[];
  /** List of config files */
  configs: ExportedFile[];
  /** Resource packs */
  resourcepacks: ExportedFile[];
  /** Shader packs */
  shaderpacks: ExportedFile[];
  /** Options.txt content */
  options?: string;
  /** Servers.dat content (base64) */
  servers?: string;
  /** Export timestamp */
  exportedAt: string;
  /** JojoClient version */
  clientVersion: string;
}

