// =============================================================================
// Version Manifest - Fetches Minecraft and Fabric version information
// =============================================================================

// Hardcoded versions for initial implementation
export const DEFAULT_MC_VERSION = "1.21.4";
export const DEFAULT_FABRIC_LOADER_VERSION = "0.18.4";

// =============================================================================
// Types
// =============================================================================

export type MinecraftVersion = {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  url: string;
  releaseTime: string;
};

export type FabricLoaderVersion = {
  version: string;
  stable: boolean;
};

export type VersionManifest = {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
};

export type LibraryDownload = {
  path: string;
  sha1: string;
  size: number;
  url: string;
};

export type Library = {
  name: string;
  downloads?: {
    artifact?: LibraryDownload;
    classifiers?: Record<string, LibraryDownload>;
  };
  natives?: Record<string, string>;
  url?: string;
  rules?: Array<{
    action: "allow" | "disallow";
    os?: { name?: string; arch?: string; version?: string };
  }>;
};

export type ArgumentRule = {
  action: "allow" | "disallow";
  os?: { name?: string; arch?: string; version?: string };
  features?: Record<string, boolean>;
};

export type AssetIndex = {
  id: string;
  sha1: string;
  size: number;
  totalSize: number;
  url: string;
};

export type VersionDetails = {
  id: string;
  type: string;
  mainClass: string;
  minecraftArguments?: string;
  arguments?: {
    game: Array<string | { value: string | string[]; rules?: ArgumentRule[] }>;
    jvm: Array<string | { value: string | string[]; rules?: ArgumentRule[] }>;
  };
  libraries: Library[];
  downloads: {
    client: {
      sha1: string;
      size: number;
      url: string;
    };
  };
  assetIndex: AssetIndex;
  assets: string;
  javaVersion?: {
    component: string;
    majorVersion: number;
  };
};

export type FabricVersionDetails = {
  id: string;
  inheritsFrom: string;
  mainClass: string;
  libraries: Library[];
  arguments?: {
    game: string[];
    jvm: string[];
  };
};

// =============================================================================
// API URLs
// =============================================================================

const MC_VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FABRIC_META_URL = "https://meta.fabricmc.net/v2";

// =============================================================================
// Fetch helper with timeout — prevents indefinite hangs when APIs are unreachable
// (e.g. Fabric Maven being down during createInstallation → busy spinner at
// 100 % CPU due to software-rendered CSS animation → apparent PC freeze).
// =============================================================================

const FETCH_TIMEOUT_MS = 15_000; // 15 s — generous enough for cold cache, tight enough to not feel frozen.

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// Cache
// =============================================================================

let cachedVersionManifest: VersionManifest | null = null;
let cachedVersionManifestAt = 0;
let cachedFabricLoaders: FabricLoaderVersion[] | null = null;
let cachedFabricLoadersAt = 0;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// =============================================================================
// Minecraft Version APIs
// =============================================================================

/**
 * Fetch the Minecraft version manifest
 */
export async function getMinecraftVersionManifest(): Promise<VersionManifest> {
  if (cachedVersionManifest && Date.now() - cachedVersionManifestAt < CACHE_TTL_MS) return cachedVersionManifest;

  console.log("📦 Fetching Minecraft version manifest...");
  const response = await fetchWithTimeout(MC_VERSION_MANIFEST_URL);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch version manifest: ${response.status}`);
  }

  cachedVersionManifest = await response.json();
  cachedVersionManifestAt = Date.now();
  console.log(`✅ Found ${cachedVersionManifest!.versions.length} Minecraft versions`);
  return cachedVersionManifest!;
}

/**
 * Get list of release versions only
 */
export async function getMinecraftReleases(): Promise<MinecraftVersion[]> {
  const manifest = await getMinecraftVersionManifest();
  return manifest.versions.filter(v => v.type === "release");
}

/**
 * Get details for a specific Minecraft version
 */
export async function getMinecraftVersionDetails(version: string): Promise<VersionDetails> {
  const manifest = await getMinecraftVersionManifest();
  const versionInfo = manifest.versions.find(v => v.id === version);
  
  if (!versionInfo) {
    throw new Error(`Minecraft version ${version} not found`);
  }

  console.log(`📦 Fetching details for Minecraft ${version}...`);
  const response = await fetchWithTimeout(versionInfo.url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch version details: ${response.status}`);
  }

  return await response.json();
}

// =============================================================================
// Fabric Version APIs
// =============================================================================

/**
 * Fetch available Fabric loader versions
 */
export async function getFabricLoaderVersions(): Promise<FabricLoaderVersion[]> {
  if (cachedFabricLoaders && Date.now() - cachedFabricLoadersAt < CACHE_TTL_MS) return cachedFabricLoaders;

  console.log("🧵 Fetching Fabric loader versions...");
  const response = await fetchWithTimeout(`${FABRIC_META_URL}/versions/loader`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Fabric loaders: ${response.status}`);
  }

  const loaders = await response.json();
  cachedFabricLoaders = loaders.map((l: { version: string; stable: boolean }) => ({
    version: l.version,
    stable: l.stable,
  }));
  cachedFabricLoadersAt = Date.now();

  console.log(`✅ Found ${cachedFabricLoaders!.length} Fabric loader versions`);
  return cachedFabricLoaders!;
}

/**
 * Get Fabric version details for a specific MC version + loader version
 */
export async function getFabricVersionDetails(
  mcVersion: string,
  loaderVersion: string
): Promise<FabricVersionDetails> {
  console.log(`🧵 Fetching Fabric profile for MC ${mcVersion} + Loader ${loaderVersion}...`);

  const response = await fetchWithTimeout(
    `${FABRIC_META_URL}/versions/loader/${mcVersion}/${loaderVersion}/profile/json`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Fabric profile: ${response.status}`);
  }

  return await response.json();
}

/**
 * Check if Fabric supports a specific Minecraft version
 */
export async function isFabricSupported(mcVersion: string): Promise<boolean> {
  const response = await fetchWithTimeout(`${FABRIC_META_URL}/versions/loader/${mcVersion}`);
  if (!response.ok) return false;
  
  const loaders = await response.json();
  return Array.isArray(loaders) && loaders.length > 0;
}

/**
 * Get the latest stable Fabric loader version
 */
export async function getLatestFabricLoaderVersion(): Promise<string> {
  try {
    const loaders = await getFabricLoaderVersions();
    const stable = loaders.find(l => l.stable);
    return stable?.version || loaders[0]?.version || DEFAULT_FABRIC_LOADER_VERSION;
  } catch {
    return DEFAULT_FABRIC_LOADER_VERSION;
  }
}

/**
 * Get the latest stable Fabric loader version for a specific MC version
 */
export async function getLatestFabricLoaderForMcVersion(mcVersion: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`${FABRIC_META_URL}/versions/loader/${mcVersion}`);
    if (!response.ok) return null;

    const loaders = await response.json();
    if (!Array.isArray(loaders) || loaders.length === 0) return null;

    // Find stable loader
    const stable = loaders.find((l: { loader: { stable: boolean; version: string } }) => l.loader.stable);
    return stable?.loader.version || loaders[0]?.loader.version || null;
  } catch {
    // Network timeout or DNS failure — return null so callers fall back to the default.
    return null;
  }
}
