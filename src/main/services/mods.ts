import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import {
  getAllProfiles,
  getProfileById,
  getInstallationById,
  getInstallationsByProfile,
  getProfileTemplateDir,
  getInstallationDir,
  getProfileDir,
  sanitizeName,
} from "./profiles";
import { isGameRunning } from "./launcher";
import { DEFAULT_MC_VERSION } from "./versions";
import type { ModIssue } from "../types";

// ============================================
// Mod ID Extraction from JAR
// ============================================

/**
 * Reads the mod ID from a Fabric mod JAR's fabric.mod.json metadata.
 * Returns null if the JAR is invalid or doesn't contain fabric.mod.json.
 */
export function getModIdFromJar(jarPath: string): string | null {
  try {
    if (!fs.existsSync(jarPath)) return null;
    
    const zip = new AdmZip(jarPath);
    const entry = zip.getEntry("fabric.mod.json");
    if (!entry) return null;
    
    const content = zip.readAsText(entry);
    const json = JSON.parse(content) as { id?: string };
    return typeof json.id === "string" ? json.id : null;
  } catch (e) {
    console.warn(`Failed to read mod ID from ${jarPath}:`, e);
    return null;
  }
}

/**
 * Finds config files related to a given mod ID in a config directory.
 * Looks for files starting with the mod ID followed by common separators.
 */
export function findRelatedConfigFiles(configDir: string, modId: string): string[] {
  if (!fs.existsSync(configDir)) return [];
  
  const relatedFiles: string[] = [];
  const safeId = modId.toLowerCase();
  
  const scanDirectory = (dir: string, basePath: string = "") => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        // Check if directory name matches mod ID
        if (lowerName === safeId || lowerName.startsWith(`${safeId}-`) || lowerName.startsWith(`${safeId}_`)) {
          relatedFiles.push(relativePath);
        } else {
          // Recurse into subdirectories
          scanDirectory(fullPath, relativePath);
        }
      } else if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        // Check for exact match or common patterns
        if (
          lowerName === `${safeId}.json` ||
          lowerName === `${safeId}.toml` ||
          lowerName === `${safeId}.json5` ||
          lowerName === `${safeId}.properties` ||
          lowerName.startsWith(`${safeId}-`) ||
          lowerName.startsWith(`${safeId}_`) ||
          lowerName.startsWith(`${safeId}.`)
        ) {
          relatedFiles.push(relativePath);
        }
      }
    }
  };
  
  scanDirectory(configDir);
  return relatedFiles;
}

function normalizeConfigKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildConfigAliases(inputs: Array<string | null | undefined>): string[] {
  const aliases = new Set<string>();

  for (const input of inputs) {
    if (!input) continue;

    const withoutExt = input.replace(/\.[a-z0-9]+$/i, "");
    const compact = normalizeConfigKey(withoutExt);
    if (compact.length >= 6) aliases.add(compact);

    // Common naming drifts between mod IDs and config files.
    const compactWithoutCompleted = compact.replace(/^completed/, "");
    if (compactWithoutCompleted.length >= 6) aliases.add(compactWithoutCompleted);
    const compactWithoutComplete = compactWithoutCompleted.replace(/^complete/, "");
    if (compactWithoutComplete.length >= 6) aliases.add(compactWithoutComplete);
    if (compact.endsWith("s") && compact.length >= 7) {
      aliases.add(compact.slice(0, -1));
    }

    const parts = withoutExt
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    // Only include single tokens that are fairly specific.
    for (const part of parts) {
      const normalized = normalizeConfigKey(part);
      if (normalized.length >= 8) aliases.add(normalized);
    }

    // Join adjacent words to catch names like "shieldfixes" from
    // "complete-shield-fixes".
    for (let i = 0; i < parts.length; i++) {
      const two = normalizeConfigKey(`${parts[i]}${parts[i + 1] ?? ""}`);
      const three = normalizeConfigKey(`${parts[i]}${parts[i + 1] ?? ""}${parts[i + 2] ?? ""}`);
      if (two.length >= 8) aliases.add(two);
      if (three.length >= 8) aliases.add(three);
    }
  }

  return Array.from(aliases);
}

function findRelatedConfigFilesByAliases(configDir: string, aliases: string[]): string[] {
  if (!fs.existsSync(configDir) || aliases.length === 0) return [];

  const cleanedAliases = aliases
    .map(normalizeConfigKey)
    .filter((alias) => alias.length >= 6)
    .sort((a, b) => b.length - a.length);

  if (cleanedAliases.length === 0) return [];

  const matches = new Set<string>();

  const scanDirectory = (dir: string, basePath = "") => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
      const relativeNorm = normalizeConfigKey(relativePath);
      const nameNorm = normalizeConfigKey(entry.name);

      const matched = cleanedAliases.some(
        (alias) =>
          nameNorm === alias ||
          nameNorm.startsWith(alias) ||
          nameNorm.includes(alias) ||
          relativeNorm.includes(alias)
      );

      if (matched) {
        matches.add(relativePath);
        continue;
      }

      if (entry.isDirectory()) {
        scanDirectory(fullPath, relativePath);
      }
    }
  };

  scanDirectory(configDir);
  return Array.from(matches);
}

function deleteConfigPaths(configDir: string, relativePaths: string[]): string[] {
  const deleted: string[] = [];

  for (const relativePath of relativePaths) {
    const fullPath = path.join(configDir, relativePath);
    try {
      if (!fs.existsSync(fullPath)) continue;
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      deleted.push(relativePath);
      console.log(`Deleted config: ${relativePath}`);
    } catch (e) {
      console.warn(`Failed to delete config ${relativePath}:`, e);
    }
  }

  return deleted;
}

function deleteRelatedConfigFilesForMod(
  configDir: string,
  modId: string,
  modName?: string,
  modFilename?: string
): string[] {
  const directMatches = findRelatedConfigFiles(configDir, modId);
  const aliases = buildConfigAliases([modId, modName, modFilename]);
  const fuzzyMatches = findRelatedConfigFilesByAliases(configDir, aliases);
  const allMatches = Array.from(new Set([...directMatches, ...fuzzyMatches]));
  return deleteConfigPaths(configDir, allMatches);
}

/**
 * Deletes config files related to a mod from a config directory.
 * Returns the list of deleted files/folders.
 */
export function deleteRelatedConfigFiles(configDir: string, modId: string): string[] {
  return deleteRelatedConfigFilesForMod(configDir, modId);
}

export type ModDownloadTarget =
  | { type: "profile"; profileId: string; mcVersion: string; slug: string }
  | { type: "installation"; installationId: string; mcVersion: string; slug: string };

type ModrinthDependency = {
  version_id: string | null;
  project_id: string | null;
  file_name: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
};

type ModrinthVersion = {
  id: string;
  project_id: string;
  version_number: string;
  version_type: "release" | "beta" | "alpha";
  date_published: string;
  game_versions: string[];
  loaders: string[];
  files: Array<{
    url: string;
    filename: string;
    primary?: boolean;
  }>;
  dependencies: ModrinthDependency[];
};

type ModrinthProject = {
  id: string;
  slug: string;
  title: string;
  icon_url: string | null;
};

// BLOCKLIST: specific versions known to cause issues (e.g. labeled 1.21 but require newer Fabric API/dependencies)
const BLOCKLIST_VERSION_NUMBERS = [
  "mc1.21-0.6.0-beta.1-fabric", // Sodium beta that breaks Sodium Extra on 1.21
  "mc1.21-0.6.0-beta.2-fabric",
];

// Simple LRU cache to prevent unbounded memory growth
class LRUCache<V> {
  private map = new Map<string, V>();
  private maxSize: number;
  constructor(maxSize: number) { this.maxSize = maxSize; }
  get(key: string): V | undefined { return this.map.get(key); }
  set(key: string, value: V): void {
    if (this.map.has(key)) { this.map.delete(key); }
    else if (this.map.size >= this.maxSize) {
      // Evict oldest (first) entry
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }
  has(key: string): boolean { return this.map.has(key); }
}

// Cache for project ID to slug mapping
const projectIdToSlugCache = new LRUCache<string>(500);

// Cache for version ID → full version metadata (used during dep-compatibility checks)
const modVersionByIdCache = new LRUCache<ModrinthVersion>(200);

// Cache for (slug:mcVersion) → the best selected version, so repeated calls during
// resolveAllSlugsWithDependencies and downloadMod don't hit the network twice.
const modVersionCache = new LRUCache<ModrinthVersion>(200);

async function fetchProjectSlug(projectId: string): Promise<string | null> {
  if (projectIdToSlugCache.has(projectId)) {
    return projectIdToSlugCache.get(projectId) || null;
  }

  try {
    const response = await fetch(`https://api.modrinth.com/v2/project/${projectId}`);
    if (!response.ok) return null;

    const project = (await response.json()) as ModrinthProject;
    projectIdToSlugCache.set(projectId, project.slug);
    return project.slug;
  } catch {
    return null;
  }
}

async function fetchModrinthVersion(
  slug: string,
  mcVersion: string
): Promise<ModrinthVersion> {
  const cacheKey = `${slug}:${mcVersion}`;
  if (modVersionCache.has(cacheKey)) return modVersionCache.get(cacheKey)!;

  const url = `https://api.modrinth.com/v2/project/${slug}/version?game_versions=${encodeURIComponent(
    JSON.stringify([mcVersion])
  )}&loaders=${encodeURIComponent(JSON.stringify(["fabric"]))}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Modrinth request failed (${response.status})`);
  }

  const versions = (await response.json()) as ModrinthVersion[];
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(`No Modrinth version found for ${slug} on ${mcVersion}`);
  }

  // Sort by date (newest first)
  const sorted = [...versions].sort(
    (a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
  );

  const filtered = sorted.filter(v => {
    // Check version_number blocklist
    if (BLOCKLIST_VERSION_NUMBERS.includes(v.version_number)) {
      console.log(`[ModSelection] Blocked ${slug} version ${v.version_number} (version_number match)`);
      return false;
    }
    // Check filename blocklist
    const file = v.files.find((f) => f.primary) || v.files[0];
    if (file && BLOCKED_FILENAMES.some((blocked) => file.filename.toLowerCase().includes(blocked.toLowerCase()))) {
      console.log(`[ModSelection] Blocked ${slug} version ${v.version_number} (filename match: ${file.filename})`);
      return false;
    }
    return true;
  });
  
  if (filtered.length === 0) {
    // If we filtered everything, fallback to original sorted (better to have broken mod than crash app logic)
    modVersionCache.set(cacheKey, sorted[0]);
    return sorted[0];
  }

  // Filename-match helpers (unchanged from previous logic)
  const escapeRegExp = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const toTokens = (version: string) => [
    version,
    version.replace(/\./g, "-"),
    version.replace(/\./g, "_"),
  ];
  const matchesStrict = (fileName: string, version: string) => {
    const name = fileName.toLowerCase();
    const tokens = toTokens(version).map((t) => t.toLowerCase());
    return tokens.some((token) => {
      const escaped = escapeRegExp(token);
      const re = new RegExp(`${escaped}(?![._-]\\d)`);
      const reMc = new RegExp(`mc${escaped}(?![._-]\\d)`);
      return re.test(name) || reMc.test(name);
    });
  };

  // Step 1 — STRICT MC-version compatibility:
  // Only accept versions whose Modrinth-declared `game_versions` field
  // explicitly contains the exact MC version we are targeting. Filename
  // heuristics are fragile (e.g. a mod labelled "mc1.20.1" may also claim
  // 1.20 support but ship deps that only work on 1.20.1), so we trust the
  // upload metadata first.
  const strictGameVersionMatches = filtered.filter(
    (v) => Array.isArray(v.game_versions) && v.game_versions.includes(mcVersion)
  );

  // Step 2 — Build release-preferred candidate buckets.
  // Releases first, then betas, then alphas. We only descend into
  // beta/alpha if no release candidate has a fully resolvable dep chain.
  const buildBuckets = (pool: ModrinthVersion[]): ModrinthVersion[][] => [
    pool.filter((v) => v.version_type === "release"),
    pool.filter((v) => v.version_type === "beta"),
    pool.filter((v) => v.version_type === "alpha"),
  ];

  const strictBuckets = buildBuckets(strictGameVersionMatches);

  // Step 3 — Filename-based fallback bucket for the case where Modrinth
  // metadata is missing but the filename clearly indicates compatibility.
  const filenameMatches = filtered.filter((v) => {
    const file = v.files.find((f) => f.primary) || v.files[0];
    return !!file && matchesStrict(file.filename, mcVersion);
  });
  const filenameBuckets = buildBuckets(filenameMatches);

  const orderedBuckets: ModrinthVersion[][] = [...strictBuckets, ...filenameBuckets];

  // Iterate buckets best-first and pick the first candidate whose required
  // deps are compatible AND can be resolved for the target MC version.
  const MAX_CANDIDATES_TO_CHECK = 5;
  let firstSeenCandidate: ModrinthVersion | null = null;

  for (const bucket of orderedBuckets) {
    if (bucket.length === 0) continue;
    for (const candidate of bucket.slice(0, MAX_CANDIDATES_TO_CHECK)) {
      if (!firstSeenCandidate) firstSeenCandidate = candidate;

      const depsOk = await checkVersionDepsCompatible(candidate, mcVersion);
      if (!depsOk) continue;

      // Pre-flight: every required project_id dep must have a published
      // version for this MC version. Otherwise the game will crash at
      // load time because Fabric can't satisfy the dep.
      const depsResolvable = await canResolveRequiredDeps(candidate, mcVersion);
      if (!depsResolvable) continue;

      console.log(
        `[ModSelection] ${slug} (mc ${mcVersion}): Selected ${candidate.version_number} ` +
          `(${candidate.version_type}).`
      );
      modVersionCache.set(cacheKey, candidate);
      return candidate;
    }
  }

  // Nothing viable. Throw so downloadMod records an issue rather than
  // silently installing a known-broken version (which would crash the game).
  const triedCount = orderedBuckets.reduce((sum, b) => sum + b.length, 0);
  console.warn(
    `[ModSelection] ${slug} (mc ${mcVersion}): No compatible version found ` +
      `(checked ${triedCount} candidates).` +
      (firstSeenCandidate
        ? ` Newest seen: ${firstSeenCandidate.version_number} (${firstSeenCandidate.version_type}).`
        : "")
  );
  throw new Error(
    `No compatible Modrinth version found for ${slug} on Minecraft ${mcVersion} ` +
      `with fully resolvable Fabric dependencies`
  );
}

/**
 * Returns true if every required dependency declared by `version` (by
 * project_id) has at least one Modrinth version available for the target
 * MC version + fabric loader. Network errors are treated as "okay" to
 * avoid blocking on transient outages.
 */
async function canResolveRequiredDeps(
  version: ModrinthVersion,
  mcVersion: string
): Promise<boolean> {
  const requiredWithProject = version.dependencies.filter(
    (d) => d.dependency_type === "required" && d.project_id
  );

  for (const dep of requiredWithProject) {
    const projectId = dep.project_id;
    if (!projectId) continue;
    const depSlug = await fetchProjectSlug(projectId);
    if (!depSlug) continue; // transient lookup failure — be lenient

    try {
      const url = `https://api.modrinth.com/v2/project/${depSlug}/version?game_versions=${encodeURIComponent(
        JSON.stringify([mcVersion])
      )}&loaders=${encodeURIComponent(JSON.stringify(["fabric"]))}`;
      const response = await fetch(url);
      if (!response.ok) continue; // transient — be lenient
      const versions = (await response.json()) as ModrinthVersion[];
      if (!Array.isArray(versions) || versions.length === 0) {
        console.log(
          `[DepResolve] ${version.version_number}: required dep '${depSlug}' has no ` +
            `Fabric version available for mc ${mcVersion}.`
        );
        return false;
      }
    } catch {
      // network error — be lenient
      continue;
    }
  }
  return true;
}

// Files that should NEVER exist - delete on sight
const BLOCKED_FILENAMES = [
  "sodium-fabric-0.6.0-beta.1",
  "sodium-fabric-0.6.0-beta.2",
  "sodium-0.6.0-beta.1",
  "sodium-0.6.0-beta.2",
];

/**
 * Purge any known-bad mod files from a mods directory.
 * Call this before syncing to ensure blocked versions are removed.
 */
export function purgeBlockedModFiles(modsDir: string): string[] {
  const removed: string[] = [];
  if (!fs.existsSync(modsDir)) return removed;
  
  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.toLowerCase().endsWith(".jar")) continue;
    const lower = entry.toLowerCase();
    const isBlocked = BLOCKED_FILENAMES.some((blocked) => lower.includes(blocked.toLowerCase()));
    if (isBlocked) {
      try {
        fs.rmSync(path.join(modsDir, entry), { force: true });
        removed.push(entry);
        console.log(`[ModCleanup] Purged blocked file: ${entry}`);
      } catch {
        // best-effort
      }
    }
  }
  return removed;
}

function cleanupExistingModFiles(modsDir: string, slug: string, keepFilename: string): void {
  if (!fs.existsSync(modsDir)) return;
  
  // First, purge any blocked files
  purgeBlockedModFiles(modsDir);
  
  const slugLower = slug.toLowerCase();
  const tokens = new Set<string>([
    slugLower,
    slugLower.replace(/-/g, "_"),
    slugLower.replace(/-/g, ""),
    // For mods like "sodium" that have filenames like "sodium-fabric-..."
    `${slugLower}-fabric`,
    `${slugLower}_fabric`,
  ]);

  for (const entry of fs.readdirSync(modsDir)) {
    if (!entry.toLowerCase().endsWith(".jar")) continue;
    if (entry === keepFilename) continue;
    const lower = entry.toLowerCase();
    const matches = Array.from(tokens).some((t) => t.length > 2 && lower.includes(t));
    if (!matches) continue;
    try {
      fs.rmSync(path.join(modsDir, entry), { force: true });
    } catch {
      // best-effort
    }
  }
}

async function fetchModrinthVersionById(versionId: string): Promise<ModrinthVersion> {
  if (modVersionByIdCache.has(versionId)) return modVersionByIdCache.get(versionId)!;
  const url = `https://api.modrinth.com/v2/version/${versionId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Modrinth request failed (${response.status})`);
  }
  const version = (await response.json()) as ModrinthVersion;
  modVersionByIdCache.set(versionId, version);
  return version;
}

/**
 * Returns true if every required dependency that has a pinned version_id is
 * compatible with the target Minecraft version.  Unpinned deps (project_id
 * only) are not checked here — they are resolved at download time via
 * fetchModrinthVersion.
 *
 * This is used to skip mod versions whose pinned deps were built for a
 * different MC version (e.g. a mod uploaded for 1.21.1 but also labelled as
 * 1.20-compatible, while its dependency pin still points to a 1.21.1 jar).
 */
async function checkVersionDepsCompatible(
  version: ModrinthVersion,
  mcVersion: string
): Promise<boolean> {
  const pinnedRequired = version.dependencies.filter(
    (d) => d.dependency_type === "required" && d.version_id
  );
  for (const dep of pinnedRequired) {
    try {
      const depVer = await fetchModrinthVersionById(dep.version_id!);
      if (!depVer.game_versions.includes(mcVersion)) {
        console.log(
          `[DepCheck] Skipping ${version.id} (${version.version_number}): ` +
          `dep ${dep.version_id} targets [${depVer.game_versions.join(",")}] not ${mcVersion}`
        );
        return false;
      }
    } catch {
      // Can't verify — assume compatible to avoid blocking downloads on transient errors
    }
  }
  return true;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

/**
 * Download a mod and its required dependencies recursively.
 * @param target - The download target (profile or installation)
 * @param downloadedSlugs - Set of already downloaded slugs to prevent infinite loops
 * @param issues - Array to collect mod issues during download
 * @returns Info about the downloaded files
 */
export async function downloadMod(
  target: ModDownloadTarget,
  downloadedSlugs: Set<string> = new Set(),
  issues: ModIssue[] = [],
  forcedVersionId?: string
): Promise<{ filename: string; path: string; dependencies: string[]; issues: ModIssue[] }> {
  // Prevent re-downloading the same mod
  if (downloadedSlugs.has(target.slug)) {
    return { filename: "", path: "", dependencies: [], issues };
  }
  downloadedSlugs.add(target.slug);

  let modsDir: string;
  if (target.type === "profile") {
    const profile = await getProfileById(target.profileId);
    if (!profile) throw new Error("Profile not found");
    modsDir = path.join(getProfileTemplateDir(profile.name), "mods");
  } else {
    const installation = await getInstallationById(target.installationId);
    if (!installation) throw new Error("Installation not found");
    const profileName = sanitizeName(installation.profileName);
    const installationName = sanitizeName(installation.name);
    modsDir = path.join(getInstallationDir(profileName, installationName), "mods");
  }

  let version: ModrinthVersion;
  let file: { url: string; filename: string; primary?: boolean } | undefined;
  
  // Purge any blocked files BEFORE we start downloading
  purgeBlockedModFiles(modsDir);

  try {
    if (forcedVersionId) {
       const directVersion = await fetchModrinthVersionById(forcedVersionId);
       // BLOCKLIST check for forced versions too (dependencies often pin bad versions)
       const directFile = directVersion.files.find((f) => f.primary) || directVersion.files[0];
       const isBlockedByVersion = BLOCKLIST_VERSION_NUMBERS.includes(directVersion.version_number);
       const isBlockedByFilename = directFile && BLOCKED_FILENAMES.some((b) => directFile.filename.toLowerCase().includes(b.toLowerCase()));

       if (isBlockedByVersion || isBlockedByFilename) { 
          console.warn(`[ModSelection] Blocked forced version ${directVersion.version_number} (file: ${directFile?.filename}) for ${target.slug}. Falling back to smart selection.`);
          version = await fetchModrinthVersion(target.slug, target.mcVersion);
       } else {
          version = directVersion;
       }
    } else {
       version = await fetchModrinthVersion(target.slug, target.mcVersion);
    }

    file = version.files.find((f) => f.primary) || version.files[0];
    if (!file) {
      const error = "No downloadable files found for this mod";
      issues.push({
        slug: target.slug,
        modName: target.slug,
        error,
        details: "The mod version exists but contains no downloadable JAR files.",
        timestamp: Date.now(),
      });
      return { filename: "", path: "", dependencies: [], issues };
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    let details = "";
    if (
      errorMsg.includes("No Modrinth version found") ||
      errorMsg.includes("No compatible Modrinth version found")
    ) {
      details = `No compatible version of '${target.slug}' was found for Minecraft ${target.mcVersion} with Fabric loader. The mod has been skipped to keep the game launchable.`;
    } else if (errorMsg.includes("request failed")) {
      details = "Network error while fetching mod information from Modrinth.";
    } else {
      details = errorMsg;
    }
    issues.push({
      slug: target.slug,
      modName: target.slug,
      error: "Failed to fetch mod version",
      details,
      timestamp: Date.now(),
    });
    return { filename: "", path: "", dependencies: [], issues };
  }

  const destPath = path.join(modsDir, file.filename);

  // Best-effort: remove older versions of the same mod to avoid dependency conflicts.
  cleanupExistingModFiles(modsDir, target.slug, file.filename);

  try {
    await downloadFile(file.url, destPath);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    issues.push({
      slug: target.slug,
      modName: file.filename.replace(/\.jar$/, ""),
      error: "Download failed",
      details: errorMsg,
      timestamp: Date.now(),
    });
    return { filename: "", path: "", dependencies: [], issues };
  }

  // Download required dependencies
  const downloadedDeps: string[] = [];
  const requiredDeps = (version.dependencies || []).filter(
    (dep) => dep.dependency_type === "required" && dep.project_id
  );

  for (const dep of requiredDeps) {
    if (!dep.project_id) continue;

    // Get the slug for this project ID
    const depSlug = await fetchProjectSlug(dep.project_id);
    if (!depSlug || downloadedSlugs.has(depSlug)) continue;

    try {
      // Create a new target for the dependency
      const depTarget: ModDownloadTarget = target.type === "profile"
        ? { type: "profile", profileId: target.profileId, mcVersion: target.mcVersion, slug: depSlug }
        : { type: "installation", installationId: target.installationId, mcVersion: target.mcVersion, slug: depSlug };

      // Always use fetchModrinthVersion (latest for mcVersion) rather than the
      // dep's pinned version_id. Pinned IDs are set at upload time and often
      // point to the dep version for a different MC version, which would land the
      // wrong jar on disk and cause Fabric incompatibility errors at launch.
      const depResult = await downloadMod(depTarget, downloadedSlugs, issues, undefined);
      if (depResult.filename) {
        downloadedDeps.push(depSlug);
        downloadedDeps.push(...depResult.dependencies);
      }
      // Issues from dependencies are already added to the issues array
    } catch (e) {
      // Log but don't fail if a dependency can't be downloaded
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(`Failed to download dependency ${depSlug}:`, errorMsg);
      issues.push({
        slug: depSlug,
        modName: depSlug,
        error: "Dependency download failed",
        details: errorMsg,
        timestamp: Date.now(),
      });
    }
  }

  return { filename: file.filename, path: destPath, dependencies: downloadedDeps, issues };
}

export type ModListItem = {
  id: string;
  name: string;
  filename: string;
  version: string;
  enabled: boolean;
  slug?: string;
  iconUrl?: string | null;
};

type ProfileModEntry = {
  slug: string;
  title?: string;
  iconUrl?: string | null;
  enabled?: boolean;
};

type ModsBundleFile = [string, string];

type CompactModsBundle = {
  t: "m";
  v: number;
  m: Array<[string, string?, string?]>;
  d?: string[];
  s?: ModsBundleFile[];
};

type LegacyModsBundle = {
  type: "mods-bundle";
  exportVersion: number;
  profile: {
    name: string;
    minecraftVersion: string;
    fabricLoaderVersion: string;
  };
  mods: ProfileModEntry[];
  settings: {
    config: Array<{ path: string; content: string }>;
  };
};

const MODS_BUNDLE_VERSION = 1;

function getProfileModListPath(profileName: string): string {
  return path.join(getProfileDir(profileName), "mods.json");
}

function loadProfileModList(profileName: string): ProfileModEntry[] {
  const listPath = getProfileModListPath(profileName);
  if (!fs.existsSync(listPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(listPath, "utf-8"));
    return Array.isArray(data?.mods) ? (data.mods as ProfileModEntry[]) : [];
  } catch {
    return [];
  }
}

function saveProfileModList(profileName: string, modsList: ProfileModEntry[]): void {
  const listPath = getProfileModListPath(profileName);
  fs.mkdirSync(path.dirname(listPath), { recursive: true });
  fs.writeFileSync(listPath, JSON.stringify({ mods: modsList }, null, 2));
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type FileWithContent = { path: string; content: string };

function collectFilesWithContent(
  baseDir: string,
  shouldInclude?: (relativePath: string) => boolean
): FileWithContent[] {
  if (!fs.existsSync(baseDir)) return [];
  const results: FileWithContent[] = [];

  const walk = (currentDir: string, relativeRoot: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.join(relativeRoot, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else if (entry.isFile()) {
        if (shouldInclude && !shouldInclude(relativePath)) continue;
        const content = fs.readFileSync(fullPath);
        results.push({ path: relativePath, content: content.toString("base64") });
      }
    }
  };

  walk(baseDir, "");
  return results;
}

function isRelatedConfigFile(relativePath: string, modsList: ProfileModEntry[]): boolean {
  if (modsList.length === 0) return true;
  const pathKey = normalizeKey(relativePath);
  return modsList.some((entry) => {
    const slugKey = normalizeKey(entry.slug);
    const titleKey = entry.title ? normalizeKey(entry.title) : "";
    return (slugKey && pathKey.includes(slugKey)) || (titleKey && pathKey.includes(titleKey));
  });
}

type PendingSyncEntry = {
  installationId: string;
  retries: number;
  lastAttemptAt: number;
};

type PendingSync = {
  installations: PendingSyncEntry[];
};

const MAX_SYNC_RETRIES = 3;
const BASE_BACKOFF_MS = 60_000; // 1 minute base

function getPendingSyncPath(profileName: string): string {
  return path.join(getProfileDir(profileName), "pending-sync.json");
}

function loadPendingSync(profileName: string): PendingSync {
  const syncPath = getPendingSyncPath(profileName);
  if (!fs.existsSync(syncPath)) return { installations: [] };
  try {
    const data = JSON.parse(fs.readFileSync(syncPath, "utf-8"));
    if (Array.isArray(data?.installations)) {
      // Support migration from old format (string array)
      const entries = data.installations.map((entry: string | PendingSyncEntry) =>
        typeof entry === "string" ? { installationId: entry, retries: 0, lastAttemptAt: 0 } : entry
      );
      return { installations: entries };
    }
    return { installations: [] };
  } catch {
    return { installations: [] };
  }
}

function savePendingSync(profileName: string, data: PendingSync): void {
  const syncPath = getPendingSyncPath(profileName);
  fs.mkdirSync(path.dirname(syncPath), { recursive: true });
  fs.writeFileSync(syncPath, JSON.stringify(data, null, 2));
}

async function queueProfileSync(profileId: string): Promise<void> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");
  const installations = await getInstallationsByProfile(profile.name);
  const pending = loadPendingSync(profile.name);
  const existingIds = new Set(pending.installations.map(e => e.installationId));
  for (const installation of installations) {
    if (!existingIds.has(installation.id)) {
      pending.installations.push({ installationId: installation.id, retries: 0, lastAttemptAt: 0 });
    }
  }
  savePendingSync(profile.name, pending);
}

export async function processPendingSyncs(): Promise<void> {
  if (isGameRunning()) return;
  const profiles = await getAllProfiles();
  const now = Date.now();
  for (const profile of profiles) {
    const pending = loadPendingSync(profile.name);
    if (!pending.installations.length) continue;
    const remaining: PendingSyncEntry[] = [];
    let gaveUp = false;
    for (const entry of pending.installations) {
      // Skip entries that have exhausted retries
      if (entry.retries >= MAX_SYNC_RETRIES) {
        gaveUp = true;
        console.warn(`Gave up syncing installation ${entry.installationId} after ${MAX_SYNC_RETRIES} failed attempts.`);
        continue;
      }
      // Apply exponential backoff: only retry after base * 2^retries ms
      const backoff = BASE_BACKOFF_MS * Math.pow(2, entry.retries);
      if (now - entry.lastAttemptAt < backoff) {
        remaining.push(entry);
        continue;
      }
      try {
        await syncProfileModsToInstallation(profile.id, entry.installationId);
        // Success — don't push to remaining
      } catch {
        remaining.push({
          installationId: entry.installationId,
          retries: entry.retries + 1,
          lastAttemptAt: now,
        });
      }
    }
    savePendingSync(profile.name, { installations: remaining });
    if (gaveUp) {
      console.log(`Some sync retries exhausted for profile "${profile.name}". Clear pending-sync.json to retry.`);
    }
  }
}


function listModsInDir(modsDir: string): ModListItem[] {
  if (!fs.existsSync(modsDir)) return [];

  const files = fs.readdirSync(modsDir);
  const mods = files
    .filter((file) => file.endsWith(".jar") || file.endsWith(".jar.disabled"))
    .map((file) => {
      const enabled = !file.endsWith(".disabled");
      const cleanName = file.replace(/\.jar(\.disabled)?$/i, "");
      return {
        id: file,
        name: cleanName,
        filename: file,
        version: "",
        enabled,
      } as ModListItem;
    });

  return mods;
}

export async function listProfileMods(profileId: string): Promise<ModListItem[]> {
  const profile = await getProfileById(profileId);
  if (!profile) return [];
  const modsList = loadProfileModList(profile.name);
  return modsList.map((entry) => ({
    id: entry.slug,
    name: entry.title || entry.slug,
    filename: "",
    version: "",
    enabled: entry.enabled !== false,
    slug: entry.slug,
    iconUrl: entry.iconUrl ?? null,
  }));
}

export async function listInstallationMods(installationId: string): Promise<ModListItem[]> {
  const installation = await getInstallationById(installationId);
  if (!installation) return [];
  const profileName = sanitizeName(installation.profileName);
  const installName = sanitizeName(installation.name);
  const modsDir = path.join(getInstallationDir(profileName, installName), "mods");
  return listModsInDir(modsDir);
}

export async function addModToProfile(
  profileId: string,
  slug: string,
  title?: string,
  iconUrl?: string | null,
  onProgress?: (installationId: string, progress: ModSyncProgress) => void
): Promise<{ addedDependencies: string[] }> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");

  const modsList = loadProfileModList(profile.name);
  const existing = modsList.find((m) => m.slug === slug);
  let changed = false;
  const addedDependencies: string[] = [];

  if (!existing) {
    changed = true;

    // Resolve dependencies FIRST before adding anything to the mod list.
    // If dep resolution fails, the mod itself still gets added (without deps)
    // so the user sees what happened and can retry.
    const newMods: ProfileModEntry[] = [{ slug, title, iconUrl: iconUrl ?? null, enabled: true }];

    try {
      const installations = await getInstallationsByProfile(profile.name);
      const mcVersion = installations[0]?.minecraftVersion || DEFAULT_MC_VERSION;

      const version = await fetchModrinthVersion(slug, mcVersion);
      const requiredDeps = (version.dependencies || []).filter(
        (dep) => dep.dependency_type === "required" && dep.project_id
      );

      for (const dep of requiredDeps) {
        if (!dep.project_id) continue;

        const depSlug = await fetchProjectSlug(dep.project_id);
        if (!depSlug) continue;

        // Check if dependency is already in the profile
        const depExists = modsList.find((m) => m.slug === depSlug) ||
                          newMods.find((m) => m.slug === depSlug);
        if (!depExists) {
          // Fetch dependency info for title and icon
          try {
            const depProject = await fetch(`https://api.modrinth.com/v2/project/${depSlug}`);
            if (depProject.ok) {
              const depInfo = (await depProject.json()) as ModrinthProject;
              newMods.push({
                slug: depSlug,
                title: depInfo.title,
                iconUrl: depInfo.icon_url,
                enabled: true,
              });
              addedDependencies.push(depSlug);
            }
          } catch {
            // Still add with minimal info if fetch fails
            newMods.push({ slug: depSlug, enabled: true });
            addedDependencies.push(depSlug);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch mod dependencies:", e instanceof Error ? e.message : String(e));
    }

    // Add all new mods (the target mod + resolved deps) atomically to the list
    for (const entry of newMods) {
      modsList.push(entry);
    }
  } else if (existing.enabled === false) {
    existing.enabled = true;
    changed = true;
  }

  if (!changed && addedDependencies.length === 0) return { addedDependencies: [] };

  saveProfileModList(profile.name, modsList);

  if (isGameRunning()) {
    await queueProfileSync(profileId);
    return { addedDependencies };
  }

  const installations = await getInstallationsByProfile(profile.name);
  for (const installation of installations) {
    await syncProfileModsToInstallation(profileId, installation.id, (progress) => {
      onProgress?.(installation.id, progress);
    });
  }

  return { addedDependencies };
}


export type ModSyncProgress = {
  phase: "start" | "mod" | "validate" | "done";
  current: number;
  total: number;
  slug?: string;
};

type ModSyncState = {
  mcVersion: string;
  fabricLoaderVersion: string;
  slugs: string[];
};

function getSyncStatePath(modsDir: string): string {
  return path.join(modsDir, ".jojoclient-sync.json");
}

function readSyncState(modsDir: string): ModSyncState | null {
  const statePath = getSyncStatePath(modsDir);
  if (!fs.existsSync(statePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    if (!data || typeof data !== "object") return null;
    if (typeof data.mcVersion !== "string" || !Array.isArray(data.slugs)) return null;
    const fabricLoaderVersion =
      typeof data.fabricLoaderVersion === "string" ? data.fabricLoaderVersion : "";
    return { mcVersion: data.mcVersion, fabricLoaderVersion, slugs: data.slugs };
  } catch {
    return null;
  }
}

function writeSyncState(modsDir: string, state: ModSyncState): void {
  const statePath = getSyncStatePath(modsDir);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function hasJarFiles(modsDir: string): boolean {
  if (!fs.existsSync(modsDir)) return false;
  return fs.readdirSync(modsDir).some((file) => file.toLowerCase().endsWith(".jar"));
}

function snapshotInstalledModVersions(modsDir: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  if (!fs.existsSync(modsDir)) return snapshot;

  const entries = fs
    .readdirSync(modsDir)
    .filter((file) => file.toLowerCase().endsWith(".jar") || file.toLowerCase().endsWith(".jar.disabled"));

  for (const file of entries) {
    const meta = readFabricModMeta(path.join(modsDir, file));
    if (!meta?.id || !meta.version) continue;
    snapshot.set(meta.id, meta.version);
  }

  return snapshot;
}

function cleanupConfigsForChangedModVersions(
  configDir: string,
  previousVersions: Map<string, string>,
  currentVersions: Map<string, string>
): void {
  if (!fs.existsSync(configDir)) return;

  for (const [modId, oldVersion] of previousVersions.entries()) {
    const newVersion = currentVersions.get(modId);
    if (newVersion === oldVersion) continue;

    const deleted = deleteRelatedConfigFiles(configDir, modId);
    if (deleted.length > 0) {
      const reason = newVersion
        ? `version changed ${oldVersion} -> ${newVersion}`
        : `mod removed (was ${oldVersion})`;
      console.log(
        `[ModConfig] Cleared ${deleted.length} config file(s) for '${modId}' because ${reason}.`
      );
    }
  }
}

function findInstalledModDetailsById(
  modsDir: string,
  modId: string
): { name?: string; filename?: string; jarPath?: string; isDisabled?: boolean } | null {
  if (!fs.existsSync(modsDir)) return null;

  const targetId = modId.toLowerCase();
  const entries = fs
    .readdirSync(modsDir)
    .filter((file) => file.toLowerCase().endsWith(".jar") || file.toLowerCase().endsWith(".jar.disabled"))
    .sort((a, b) => {
      const aDisabled = a.toLowerCase().endsWith(".jar.disabled");
      const bDisabled = b.toLowerCase().endsWith(".jar.disabled");
      if (aDisabled === bDisabled) return a.localeCompare(b);
      return aDisabled ? 1 : -1; // Prefer enabled jars first.
    });

  for (const entry of entries) {
    const fullPath = path.join(modsDir, entry);
    const meta = readFabricModMeta(fullPath);
    if (!meta?.id) continue;
    if (meta.id.toLowerCase() !== targetId) continue;
    return {
      name: meta.name,
      filename: entry,
      jarPath: fullPath,
      isDisabled: entry.toLowerCase().endsWith(".jar.disabled"),
    };
  }

  return null;
}

function extractCrashingModId(crashContent: string): string | null {
  const patterns = [
    /provided by '([^']+)'/i,
    /from mod ([a-z0-9_.-]+)/i,
    /in config \[([a-z0-9_.-]+)\.mixins\.json\]/i,
    /Mixin \[([a-z0-9_.-]+)\.mixins\.json/i,
  ];

  for (const pattern of patterns) {
    const match = crashContent.match(pattern);
    const modId = match?.[1]?.trim();
    if (modId) return modId;
  }

  return null;
}

function recoverFromLatestConfigParseCrash(
  installationDir: string,
  minecraftVersion: string
): ModIssue[] {
  const crashReportsDir = path.join(installationDir, "crash-reports");
  const modsDir = path.join(installationDir, "mods");
  const configDir = path.join(installationDir, "config");
  if (!fs.existsSync(crashReportsDir)) return [];

  const crashFiles = fs
    .readdirSync(crashReportsDir)
    .filter((name) => /^crash-.*\.txt$/i.test(name))
    .map((name) => {
      const fullPath = path.join(crashReportsDir, name);
      let mtime = 0;
      try {
        mtime = fs.statSync(fullPath).mtimeMs;
      } catch {
        // ignore broken entries
      }
      return { name, fullPath, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (crashFiles.length === 0) return [];

  const latest = crashFiles[0];
  let content = "";
  try {
    content = fs.readFileSync(latest.fullPath, "utf-8");
  } catch {
    return [];
  }

  if (!content.includes(`Minecraft Version: ${minecraftVersion}`)) return [];

  const modId = extractCrashingModId(content);
  if (!modId) return [];

  const modDetails = findInstalledModDetailsById(modsDir, modId);
  // Detect config-parse crashes from multiple JSON/TOML parsers.
  // Gson uses JsonSyntaxException/Expected BEGIN_*; kotlinx.serialization
  // and NightConfig use different messages; most parsers include "Exception"
  // when a config file fails to parse.
  const isJsonConfigCrash =
    content.includes("JsonSyntaxException") ||
    content.includes("Expected BEGIN_OBJECT") ||
    content.includes("Expected BEGIN_ARRAY") ||
    content.includes("JsonParseException") ||
    content.includes("TomlParseException") ||
    content.includes("ConfigParseException") ||
    (content.includes("Config") && content.includes("Exception") &&
     (content.includes(".json") || content.includes(".toml") || content.includes(".json5")));

  const deletedConfigs = deleteRelatedConfigFilesForMod(
    configDir,
    modId,
    modDetails?.name,
    modDetails?.filename
  );

  let disabledJar: string | null = null;
  if (!isJsonConfigCrash) {
    if (modDetails?.jarPath && !modDetails.isDisabled && fs.existsSync(modDetails.jarPath)) {
      const disabledPath = `${modDetails.jarPath}.disabled`;
      try {
        // If a disabled copy already exists, remove it first to keep only the
        // latest crashing file as the disabled one.
        if (fs.existsSync(disabledPath)) {
          fs.rmSync(disabledPath, { force: true });
        }
        fs.renameSync(modDetails.jarPath, disabledPath);
        disabledJar = path.basename(disabledPath);
      } catch {
        // best-effort
      }
    }
  }

  if (deletedConfigs.length === 0 && !disabledJar) {
    // Nothing actionable found in this installation for the latest crash.
    return [];
  }

  console.log(
    `[CrashRecovery] Applied recovery for '${modId}' based on ${latest.name}: ` +
      `clearedConfigs=${deletedConfigs.length}, disabledJar=${disabledJar ?? "none"}`
  );

  const causeLine = content
    .split(/\r?\n/)
    .find((line) => line.startsWith("Caused by:"))
    ?.trim();

  const details: string[] = [];
  if (deletedConfigs.length > 0) {
    details.push(`Cleared config: ${deletedConfigs.join(", ")}`);
  }
  if (disabledJar) {
    details.push(`Disabled crashing mod jar: ${disabledJar}`);
  }
  if (causeLine) {
    details.push(causeLine);
  }

  return [
    {
      slug: modId,
      modName: modDetails?.name || modId,
      error: disabledJar
        ? "Recovered from startup crash (mod quarantined)"
        : "Recovered from startup crash (config reset)",
      details: `Detected startup crash in ${latest.name}. ${details.join(" | ")}`,
      timestamp: Date.now(),
    },
  ];
}

/**
 * Recursively resolves the full set of required dependency slugs for a list of
 * mod slugs against a specific MC version. Returns every slug that will be
 * needed on disk (explicit mods + all transitive required deps).
 *
 * Results are used to build an accurate sync-state key so the cache is
 * invalidated whenever the dependency graph changes (e.g. after a version switch).
 */
async function resolveAllSlugsWithDependencies(
  slugs: string[],
  mcVersion: string
): Promise<Set<string>> {
  const resolved = new Set<string>();
  const queue = [...slugs];

  while (queue.length > 0) {
    const slug = queue.shift()!;
    if (resolved.has(slug)) continue;
    resolved.add(slug);

    try {
      const version = await fetchModrinthVersion(slug, mcVersion);
      const requiredDeps = (version.dependencies ?? []).filter(
        (dep) => dep.dependency_type === "required" && dep.project_id
      );
      for (const dep of requiredDeps) {
        if (!dep.project_id) continue;
        const depSlug = await fetchProjectSlug(dep.project_id);
        if (depSlug && !resolved.has(depSlug)) {
          queue.push(depSlug);
        }
      }
    } catch {
      // If we can't fetch a mod's version info, still include it in the set —
      // the download step will surface the real error later.
    }
  }

  return resolved;
}

// ============================================
// Post-download dependency validation
// ============================================

/**
 * Fabric dependency predicates use a mix of semver-like operators, wildcard
 * patterns and interval notation. We implement a pragmatic evaluator that
 * supports the common forms seen in fabric.mod.json:
 *   - comparators: >=, >, <=, <, =
 *   - compatible operators: ^, ~
 *   - wildcard: 1.20.x, 0.15.*
 *   - intervals: [1.0.0,2.0.0), (,0.16.0]
 *   - conjunctions: ">=0.14 <0.16"
 *   - disjunctions: "1.20.x || 1.21.x"
 */
function parseVersionTuples(version: string): number[] {
  const buildStripped = version.split("+")[0];
  const hyphenIndex = buildStripped.indexOf("-");
  const maybeSuffix = hyphenIndex >= 0 ? buildStripped.slice(hyphenIndex + 1) : "";
  // Treat alphanumeric hyphen suffixes as prerelease tags (e.g. alpha/beta/rc)
  // so stable runtime versions still satisfy ranges like ~1.16.2-alpha.20.28.a.
  const core =
    hyphenIndex >= 0 && /[a-z]/i.test(maybeSuffix)
      ? buildStripped.slice(0, hyphenIndex)
      : buildStripped;

  return core
    .replace(/[^0-9]+/g, ".")
    .split(".")
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

function compareVersions(a: string, b: string): number {
  const partsA = parseVersionTuples(a);
  const partsB = parseVersionTuples(b);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isWildcardVersion(version: string): boolean {
  const normalized = version.toLowerCase();
  return normalized.includes("x") || normalized.includes("*");
}

function matchesVersionPrefix(installed: string, expected: string): boolean {
  const installedParts = parseVersionTuples(installed);
  const expectedParts = parseVersionTuples(expected);
  if (expectedParts.length === 0) return true;
  for (let i = 0; i < expectedParts.length; i++) {
    if ((installedParts[i] ?? 0) !== expectedParts[i]) return false;
  }
  return true;
}

function matchesWildcardVersion(installed: string, pattern: string): boolean {
  const installedParts = installed
    .split("+")[0]
    .split(".")
    .map((segment) => segment.toLowerCase().replace(/[^0-9x*]/g, ""));
  const patternParts = pattern
    .split("+")[0]
    .split(".")
    .map((segment) => segment.toLowerCase().replace(/[^0-9x*]/g, ""));

  for (let i = 0; i < patternParts.length; i++) {
    const wanted = patternParts[i];
    if (!wanted || wanted === "x" || wanted === "*") return true;
    const have = installedParts[i] ?? "";
    if (!have || Number(have) !== Number(wanted)) return false;
  }
  return true;
}

function upperBoundForCaret(version: string): string {
  const parts = parseVersionTuples(version);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  if (major > 0) return `${major + 1}.0.0`;
  if (minor > 0) return `0.${minor + 1}.0`;
  return `0.0.${patch + 1}`;
}

function upperBoundForTilde(version: string): string {
  const parts = parseVersionTuples(version);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  if (parts.length >= 2) return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

function satisfiesSinglePredicate(installed: string, predicate: string): boolean {
  const token = predicate.trim();
  if (!token || token === "*") return true;

  const interval = token.match(/^([[(])\s*([^,]*)\s*,\s*([^\]\)]*)\s*([\]\)])$/);
  if (interval) {
    const leftInclusive = interval[1] === "[";
    const lower = interval[2].trim();
    const upper = interval[3].trim();
    const rightInclusive = interval[4] === "]";

    if (lower) {
      const cmp = compareVersions(installed, lower);
      if (leftInclusive ? cmp < 0 : cmp <= 0) return false;
    }
    if (upper) {
      const cmp = compareVersions(installed, upper);
      if (rightInclusive ? cmp > 0 : cmp >= 0) return false;
    }
    return true;
  }

  const comparatorMatch = token.match(/^(>=|<=|>|<|=|\^|~)\s*(.+)$/);
  if (comparatorMatch) {
    const op = comparatorMatch[1];
    const raw = comparatorMatch[2].trim();

    if (isWildcardVersion(raw)) {
      return matchesWildcardVersion(installed, raw);
    }

    if (op === ">=") return compareVersions(installed, raw) >= 0;
    if (op === ">") return compareVersions(installed, raw) > 0;
    if (op === "<=") return compareVersions(installed, raw) <= 0;
    if (op === "<") return compareVersions(installed, raw) < 0;
    if (op === "=") return compareVersions(installed, raw) === 0 || matchesVersionPrefix(installed, raw);
    if (op === "^") {
      return (
        compareVersions(installed, raw) >= 0 &&
        compareVersions(installed, upperBoundForCaret(raw)) < 0
      );
    }
    if (op === "~") {
      return (
        compareVersions(installed, raw) >= 0 &&
        compareVersions(installed, upperBoundForTilde(raw)) < 0
      );
    }
  }

  if (isWildcardVersion(token)) {
    return matchesWildcardVersion(installed, token);
  }

  // Plain version token: require exact or prefix match.
  return compareVersions(installed, token) === 0 || matchesVersionPrefix(installed, token);
}

function satisfiesVersionRange(installed: string, range: string): boolean {
  const trimmed = range.trim();
  if (!trimmed || trimmed === "*") return true;

  const orParts = trimmed.split("||").map((part) => part.trim()).filter(Boolean);
  if (orParts.length === 0) return true;

  for (const part of orParts) {
    const partIsSingleInterval = /^([[(])\s*[^,]*\s*,\s*[^\]\)]*\s*([\]\)])$/.test(part);
    if (partIsSingleInterval && satisfiesSinglePredicate(installed, part)) {
      return true;
    }

    const tokens = part
      .split(/\s+/)
      .flatMap((segment) => segment.split(","))
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (tokens.length > 0 && tokens.every((token) => satisfiesSinglePredicate(installed, token))) {
      return true;
    }
  }

  return false;
}

type FabricModJson = {
  id?: string;
  version?: string;
  name?: string;
  depends?: Record<string, string | string[]>;
  provides?: string[];
  jars?: Array<{ file: string }>;
};

type InstalledModMeta = {
  id: string;
  version: string;
  name: string;
  filename: string;
  jarPath: string;
  depends: Record<string, string[]>;
};

type DependencyValidationContext = {
  minecraftVersion: string;
  fabricLoaderVersion: string;
  configDir?: string;
};

// Runtime-provided IDs that should not be resolved from installed mod jars.
const RUNTIME_PROVIDED_IDS = new Set([
  "java",
  "fabric-language-kotlin",
  "fabric-language-scala",
  "mixinextras",
]);

function getRuntimeDependencyVersion(
  depId: string,
  context: DependencyValidationContext
): string | null {
  const normalized = depId.toLowerCase();
  if (normalized === "minecraft") return context.minecraftVersion;
  if (normalized === "fabricloader" || normalized === "fabric-loader") {
    return context.fabricLoaderVersion;
  }
  return null;
}

/**
 * Reads fabric.mod.json metadata from a mod JAR.
 */
function readFabricModMeta(jarPath: string): FabricModJson | null {
  try {
    const zip = new AdmZip(jarPath);
    const entry = zip.getEntry("fabric.mod.json");
    if (!entry) return null;
    const raw = zip.readAsText(entry);
    return JSON.parse(raw) as FabricModJson;
  } catch {
    return null;
  }
}

/**
 * Reads all sub-module IDs + versions from nested JARs listed in the
 * fabric.mod.json `jars` field (`META-INF/jars/...`).  Fabric API bundles
 * dozens of sub-modules this way (fabric-resource-loader-v0, etc.).
 */
function readNestedModIds(
  jarPath: string,
  jarsField: Array<{ file: string }>
): Array<{ id: string; version: string }> {
  const results: Array<{ id: string; version: string }> = [];
  try {
    const parentZip = new AdmZip(jarPath);
    for (const jar of jarsField) {
      try {
        const nestedEntry = parentZip.getEntry(jar.file);
        if (!nestedEntry) continue;
        const nestedBuffer = nestedEntry.getData();
        const nestedZip = new AdmZip(nestedBuffer);
        const nestedMeta = nestedZip.getEntry("fabric.mod.json");
        if (!nestedMeta) continue;
        const parsed = JSON.parse(nestedZip.readAsText(nestedMeta)) as FabricModJson;
        if (parsed.id && parsed.version) {
          results.push({ id: parsed.id, version: parsed.version });
        }
      } catch {
        // Skip unreadable nested JARs
      }
    }
  } catch {
    // Parent JAR read error — already handled elsewhere
  }
  return results;
}

/**
 * Scans every .jar in modsDir and validates that each mod's required
 * dependencies are present at a compatible version.
 *
 * Mods with unsatisfied deps are renamed to .jar.disabled so Fabric won't
 * try to load them (which would crash the game). An issue is created for
 * each disabled mod so the user can see what happened in the UI.
 *
 * Returns the list of issues generated during validation.
 */
function validateModDependencies(
  modsDir: string,
  context: DependencyValidationContext
): ModIssue[] {
  if (!fs.existsSync(modsDir)) return [];

  // 1. Build registry of all installed mods
  const jars = fs.readdirSync(modsDir).filter((f) => f.toLowerCase().endsWith(".jar"));
  const modRegistry = new Map<string, InstalledModMeta>();
  const allMods: InstalledModMeta[] = [];

  for (const filename of jars) {
    const jarPath = path.join(modsDir, filename);
    const meta = readFabricModMeta(jarPath);
    if (!meta?.id || !meta.version) continue;

    // Normalize depends: fabric.mod.json allows string or string[] values
    const normalizedDeps: Record<string, string[]> = {};
    if (meta.depends && typeof meta.depends === "object") {
      for (const [depId, range] of Object.entries(meta.depends)) {
        if (Array.isArray(range)) {
          const options = range
            .filter((r): r is string => typeof r === "string")
            .map((r) => r.trim())
            .filter(Boolean);
          normalizedDeps[depId.toLowerCase()] = options.length > 0 ? options : ["*"];
        } else if (typeof range === "string") {
          const trimmed = range.trim();
          normalizedDeps[depId.toLowerCase()] = [trimmed || "*"];
        }
      }
    }

    const entry: InstalledModMeta = {
      id: meta.id,
      version: meta.version,
      name: meta.name ?? meta.id,
      filename,
      jarPath,
      depends: normalizedDeps,
    };

    modRegistry.set(meta.id.toLowerCase(), entry);
    allMods.push(entry);

    // Register aliases from the "provides" field
    if (Array.isArray(meta.provides)) {
      for (const alias of meta.provides) {
        if (typeof alias === "string" && !modRegistry.has(alias.toLowerCase())) {
          modRegistry.set(alias.toLowerCase(), entry);
        }
      }
    }

    // Register sub-modules from nested JARs (e.g. Fabric API bundles
    // fabric-resource-loader-v0, fabric-rendering-v1, etc. inside
    // META-INF/jars/).  These are loaded at runtime by Fabric Loader.
    if (Array.isArray(meta.jars) && meta.jars.length > 0) {
      const nested = readNestedModIds(jarPath, meta.jars);
      for (const sub of nested) {
        if (!modRegistry.has(sub.id.toLowerCase())) {
          // Create a synthetic entry so deps on sub-modules are satisfied
          modRegistry.set(sub.id.toLowerCase(), {
            id: sub.id,
            version: sub.version,
            name: sub.id,
            filename,
            jarPath,
            depends: {},
          });
        }
      }
    }
  }

  // Register well-known aliases:
  // Many older mods list "fabric" as a dependency, which is the mod ID that
  // Fabric API's top-level fabric.mod.json uses internally.  If fabric-api is
  // present but "fabric" isn't registered yet, alias it.
  if (modRegistry.has("fabric-api") && !modRegistry.has("fabric")) {
    modRegistry.set("fabric", modRegistry.get("fabric-api")!);
  }

  // 2. Validate each mod's dependencies against the registry/runtime.
  const issues: ModIssue[] = [];
  const disabledModPaths = new Set<string>();

  const disableMod = (mod: InstalledModMeta, reasons: string[]): void => {
    if (disabledModPaths.has(mod.jarPath)) return;

    const disabledPath = mod.jarPath + ".disabled";
    let renamed = false;
    try {
      fs.renameSync(mod.jarPath, disabledPath);
      renamed = true;
      disabledModPaths.add(mod.jarPath);
      console.log(`[DepValidation] Disabled '${mod.name}' (${mod.filename}): ${reasons.join("; ")}`);
    } catch (e) {
      console.warn(`[DepValidation] Failed to disable '${mod.filename}':`, e);
    }

    const details = [...reasons];
    if (context.configDir) {
      const deletedConfigs = deleteRelatedConfigFilesForMod(
        context.configDir,
        mod.id,
        mod.name,
        mod.filename
      );
      if (deletedConfigs.length > 0) {
        details.push(`Cleared config files: ${deletedConfigs.join(", ")}`);
      }
    }

    issues.push({
      slug: mod.id,
      modName: mod.name,
      error: renamed
        ? "Incompatible dependencies/runtime version — mod disabled"
        : "Incompatible dependencies/runtime version (could not auto-disable)",
      details: details.join("\n"),
      timestamp: Date.now(),
    });
  };

  // Pre-pass: keep only one JAR per Fabric mod ID. Duplicate IDs can produce
  // unpredictable behavior and crashes before dependency checks are reached.
  const modsById = new Map<string, InstalledModMeta[]>();
  for (const mod of allMods) {
    const id = mod.id.toLowerCase();
    const list = modsById.get(id) ?? [];
    list.push(mod);
    modsById.set(id, list);
  }

  for (const [id, candidates] of modsById.entries()) {
    if (candidates.length <= 1) continue;

    const ordered = [...candidates].sort((a, b) => {
      const versionCmp = compareVersions(b.version, a.version);
      if (versionCmp !== 0) return versionCmp;
      return a.filename.localeCompare(b.filename);
    });

    const keeper = ordered[0];
    modRegistry.set(id, keeper);

    for (const duplicate of ordered.slice(1)) {
      disableMod(duplicate, [
        `Duplicate mod id '${duplicate.id}' detected. Keeping '${keeper.filename}' (${keeper.version}) instead of '${duplicate.filename}' (${duplicate.version}).`,
      ]);
    }
  }

  // Re-run until stable to catch cascades after disabling a dependency provider.
  let changed = true;
  while (changed) {
    changed = false;

    for (const mod of allMods) {
      if (disabledModPaths.has(mod.jarPath)) continue;

      const unsatisfied: string[] = [];
      for (const [depId, ranges] of Object.entries(mod.depends)) {
        const runtimeVersion = getRuntimeDependencyVersion(depId, context);
        const requirementText = ranges.join(" || ");

        if (runtimeVersion) {
          const ok = ranges.some((range) => satisfiesVersionRange(runtimeVersion, range));
          if (!ok) {
            unsatisfied.push(
              `Runtime '${depId}' version ${runtimeVersion} does not satisfy required ${requirementText}`
            );
          }
          continue;
        }

        // Ignore runtime-provided non-versioned deps (e.g. java).
        if (RUNTIME_PROVIDED_IDS.has(depId)) continue;

        const installed = modRegistry.get(depId);
        if (!installed || disabledModPaths.has(installed.jarPath)) {
          unsatisfied.push(`Missing dependency '${depId}'`);
          continue;
        }

        const ok = ranges.some((range) => satisfiesVersionRange(installed.version, range));
        if (!ok) {
          unsatisfied.push(
            `'${depId}' version ${installed.version} does not satisfy required ${requirementText}`
          );
        }
      }

      if (unsatisfied.length > 0) {
        disableMod(mod, unsatisfied);
        changed = true;
      }
    }
  }

  return issues;
}

export async function syncProfileModsToInstallation(
  profileId: string,
  installationId: string,
  onProgress?: (progress: ModSyncProgress) => void
): Promise<{ failed: string[]; issues: ModIssue[]; skipped?: true }> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");
  const installation = await getInstallationById(installationId);
  if (!installation) throw new Error("Installation not found");

  const profileName = sanitizeName(profile.name);
  const installName = sanitizeName(installation.name);
  const installationDir = getInstallationDir(profileName, installName);
  const modsDir = path.join(installationDir, "mods");
  const configDir = path.join(installationDir, "config");
  const runtimeContext: DependencyValidationContext = {
    minecraftVersion: installation.minecraftVersion,
    fabricLoaderVersion: installation.fabricLoaderVersion,
    configDir,
  };
  const previousModVersions = snapshotInstalledModVersions(modsDir);

  const modsList = loadProfileModList(profile.name);
  const enabledMods = modsList.filter((m) => m.enabled !== false);
  const explicitSlugs = enabledMods.map((m) => m.slug);

  // Resolve the full dependency graph so the sync-state key includes all required
  // mods (explicit + transitive deps). This ensures the cache is invalidated when
  // a version switch changes which dependency versions are needed.
  const allRequiredSlugs = await resolveAllSlugsWithDependencies(
    explicitSlugs,
    installation.minecraftVersion
  );

  const desiredState: ModSyncState = {
    mcVersion: installation.minecraftVersion,
    fabricLoaderVersion: installation.fabricLoaderVersion,
    slugs: Array.from(allRequiredSlugs).sort(),
  };

  const existingState = readSyncState(modsDir);
  const stateMatches =
    existingState &&
    existingState.mcVersion === desiredState.mcVersion &&
    existingState.fabricLoaderVersion === desiredState.fabricLoaderVersion &&
    JSON.stringify(existingState.slugs) === JSON.stringify(desiredState.slugs);

  // If state matches and we have jar files, skip downloads but ALWAYS re-run
  // dependency validation. Validation is cheap (just reads JAR metadata) and
  // catches any incompatible jars that survived a previous sync — including
  // jars the user dropped in manually or jars whose .disabled marker was
  // removed externally.
  if (stateMatches && hasJarFiles(modsDir)) {
    console.log(`✅ Mods already synced for installation ${installationId}, validating only`);
    onProgress?.({ phase: "start", current: 0, total: 0 });
    onProgress?.({ phase: "validate", current: 0, total: 0 });
    const crashRecoveryIssues = recoverFromLatestConfigParseCrash(
      installationDir,
      installation.minecraftVersion
    );
    const validationIssues = validateModDependencies(modsDir, runtimeContext);
    onProgress?.({ phase: "done", current: 0, total: 0 });
    const combinedIssues = [...crashRecoveryIssues, ...validationIssues];
    const failedFromValidation = Array.from(
      new Set(validationIssues.map((i) => i.slug))
    );
    // skipped: true only if no validation issues surfaced — when the validator
    // disables a jar we don't want callers to treat the sync as a no-op.
    return {
      failed: failedFromValidation,
      issues: combinedIssues,
      skipped: combinedIssues.length === 0 ? true : undefined,
    };
  }

  // Try to clear mods folder - if it fails (EBUSY), the game is running with these mods
  if (fs.existsSync(modsDir)) {
    try {
      fs.rmSync(modsDir, { recursive: true, force: true });
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EBUSY" || code === "EPERM") {
        // Files are locked by running game - this is fine if state already matches
        if (stateMatches) {
          console.log(`⚠️ Mods folder locked but state matches, skipping sync for ${installationId}`);
          onProgress?.({ phase: "start", current: 0, total: 0 });
          onProgress?.({ phase: "done", current: 0, total: 0 });
          return { failed: [], issues: [], skipped: true };
        }
        // State doesn't match but files are locked - rethrow as user-friendly error
        throw new Error(`Cannot sync mods: files are in use by running game. Close the game first.`);
      }
      throw e;
    }
  }
  fs.mkdirSync(modsDir, { recursive: true });
  const total = enabledMods.length;
  onProgress?.({ phase: "start", current: 0, total });
  const failed: string[] = [];
  const allIssues: ModIssue[] = [];
  allIssues.push(
    ...recoverFromLatestConfigParseCrash(installationDir, installation.minecraftVersion)
  );
  // Seed downloadedSlugs with the resolved set so downloadMod won't re-fetch deps
  // it already knows about from resolveAllSlugsWithDependencies.
  const downloadedSlugs = new Set<string>();

  let current = 0;
  for (const entry of enabledMods) {
    // Skip if already downloaded as a dependency
    if (downloadedSlugs.has(entry.slug)) continue;

    const issues: ModIssue[] = [];
    await downloadMod(
      {
        type: "installation",
        installationId: installation.id,
        mcVersion: installation.minecraftVersion,
        slug: entry.slug,
      },
      downloadedSlugs,
      issues
    );
    
    if (issues.length > 0) {
      allIssues.push(...issues);
      failed.push(entry.slug);
    }

    current += 1;
    onProgress?.({ phase: "mod", current, total, slug: entry.slug });
  }

  // Validate dependencies: scan every downloaded jar, check its fabric.mod.json
  // `depends` block, and disable mods whose deps are missing or incompatible.
  onProgress?.({ phase: "validate", current: 0, total: 0 });
  const validationIssues = validateModDependencies(modsDir, runtimeContext);
  if (validationIssues.length > 0) {
    allIssues.push(...validationIssues);
    for (const issue of validationIssues) {
      if (!failed.includes(issue.slug)) {
        failed.push(issue.slug);
      }
    }
  }

  const currentModVersions = snapshotInstalledModVersions(modsDir);
  cleanupConfigsForChangedModVersions(configDir, previousModVersions, currentModVersions);

  onProgress?.({ phase: "done", current: total, total });

  // Write the fully-resolved slug set (explicit + all deps) so future cache
  // comparisons will catch any change in the dependency graph.
  writeSyncState(modsDir, desiredState);

  return { failed, issues: allIssues };
}

export async function setProfileModEnabled(
  profileId: string,
  slug: string,
  enabled: boolean
): Promise<void> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");

  const modsList = loadProfileModList(profile.name);
  const target = modsList.find((m) => m.slug === slug);
  if (!target) throw new Error("Mod not found in profile");

  if (target.enabled === enabled) return;
  target.enabled = enabled;
  saveProfileModList(profile.name, modsList);

  if (isGameRunning()) {
    await queueProfileSync(profileId);
    return;
  }

  const installations = await getInstallationsByProfile(profile.name);
  for (const installation of installations) {
    await syncProfileModsToInstallation(profileId, installation.id);
  }
}

export async function deleteMod(
  target:
    | { type: "profile"; profileId: string; slug: string }
    | { type: "installation"; installationId: string; filename: string }
): Promise<{ deletedConfigs: string[] }> {
  let modsDir: string;
  const deletedConfigs: string[] = [];

  if (target.type === "profile") {
    const profile = await getProfileById(target.profileId);
    if (!profile) throw new Error("Profile not found");
    
    const templateDir = getProfileTemplateDir(profile.name);
    const templateModsDir = path.join(templateDir, "mods");
    const templateConfigDir = path.join(templateDir, "config");
    
    // Track the mod ID and deleted filenames for cleaning up installations
    let modId: string | null = null;
    const deletedJarFilenames: string[] = [];
    
    // Find and delete the mod JAR file from template, extracting mod ID for config cleanup
    if (fs.existsSync(templateModsDir)) {
      const modFiles = fs.readdirSync(templateModsDir).filter(f => f.endsWith(".jar"));
      for (const modFile of modFiles) {
        const jarPath = path.join(templateModsDir, modFile);
        // Check if this JAR's filename contains the slug (common convention)
        const lowerFile = modFile.toLowerCase();
        const lowerSlug = target.slug.toLowerCase().replace(/-/g, "");
        
        if (lowerFile.includes(lowerSlug) || lowerFile.includes(target.slug.toLowerCase())) {
          // Extract mod ID before deleting
          modId = getModIdFromJar(jarPath);
          
          // Delete the JAR file from template
          try {
            fs.unlinkSync(jarPath);
            deletedJarFilenames.push(modFile);
            console.log(`Deleted mod JAR from template: ${modFile}`);
          } catch (e) {
            console.warn(`Failed to delete mod JAR ${modFile}:`, e);
          }
          
          // Delete related config files from template
          if (modId) {
            const deleted = deleteRelatedConfigFiles(templateConfigDir, modId);
            deletedConfigs.push(...deleted);
          }
          break; // Found and processed the mod
        }
      }
    }
    
    // Also try using slug directly as a fallback for config cleanup
    // (in case JAR wasn't found or mod ID extraction failed)
    if (deletedConfigs.length === 0) {
      const slugBasedDeleted = deleteRelatedConfigFiles(templateConfigDir, target.slug);
      deletedConfigs.push(...slugBasedDeleted);
    }
    
    // Update the mods list
    const modsList = loadProfileModList(profile.name);
    const updated = modsList.filter((m) => m.slug !== target.slug);
    saveProfileModList(profile.name, updated);

    // Delete mod files from ALL installations of this profile
    const installations = await getInstallationsByProfile(profile.name);
    for (const installation of installations) {
      const profileName = sanitizeName(profile.name);
      const installName = sanitizeName(installation.name);
      const installModsDir = path.join(getInstallationDir(profileName, installName), "mods");
      const installConfigDir = path.join(getInstallationDir(profileName, installName), "config");
      
      if (fs.existsSync(installModsDir)) {
        // Delete mod files that match the deleted filenames
        for (const filename of deletedJarFilenames) {
          const filePath = path.join(installModsDir, filename);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`Deleted mod JAR from installation ${installation.name}: ${filename}`);
            } catch (e) {
              console.warn(`Failed to delete mod JAR ${filename} from installation ${installation.name}:`, e);
            }
          }
        }
        
        // Also search for files matching the slug pattern (in case filenames differ)
        const installModFiles = fs.readdirSync(installModsDir).filter(f => f.endsWith(".jar"));
        for (const modFile of installModFiles) {
          const lowerFile = modFile.toLowerCase();
          const lowerSlug = target.slug.toLowerCase().replace(/-/g, "");
          
          if (lowerFile.includes(lowerSlug) || lowerFile.includes(target.slug.toLowerCase())) {
            const filePath = path.join(installModsDir, modFile);
            try {
              fs.unlinkSync(filePath);
              console.log(`Deleted mod JAR from installation ${installation.name}: ${modFile}`);
            } catch (e) {
              console.warn(`Failed to delete mod JAR ${modFile} from installation ${installation.name}:`, e);
            }
          }
        }
        
        // Update the sync state file to reflect the removed mod
        const syncStatePath = getSyncStatePath(installModsDir);
        if (fs.existsSync(syncStatePath)) {
          try {
            const stateData = JSON.parse(fs.readFileSync(syncStatePath, "utf-8"));
            if (Array.isArray(stateData.slugs)) {
              stateData.slugs = stateData.slugs.filter((s: string) => s !== target.slug);
              fs.writeFileSync(syncStatePath, JSON.stringify(stateData, null, 2));
            }
          } catch (e) {
            console.warn(`Failed to update sync state for installation ${installation.name}:`, e);
          }
        }
      }
      
      // Delete related config files from installation
      if (modId && fs.existsSync(installConfigDir)) {
        deleteRelatedConfigFiles(installConfigDir, modId);
      }
    }
    
    return { deletedConfigs };
  } else {
    const installation = await getInstallationById(target.installationId);
    if (!installation) throw new Error("Installation not found");
    const profileName = sanitizeName(installation.profileName);
    const installName = sanitizeName(installation.name);
    modsDir = path.join(getInstallationDir(profileName, installName), "mods");
  }

  if (!target.filename) {
    throw new Error("Mod filename is required for installation deletes");
  }
  const filePath = path.join(modsDir, target.filename);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
  
  return { deletedConfigs };
}

export async function exportProfileModsBundle(
  profileId: string,
  slugs?: string[]
): Promise<string> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");

  const modsList = loadProfileModList(profile.name);
  const selected = Array.isArray(slugs) && slugs.length > 0
    ? modsList.filter((m) => slugs.includes(m.slug))
    : modsList;

  const templateDir = getProfileTemplateDir(profile.name);
  const configDir = path.join(templateDir, "config");
  const settingsFiles = collectFilesWithContent(configDir, (relativePath) =>
    isRelatedConfigFile(relativePath, selected)
  ).map((file) => [file.path, file.content] as ModsBundleFile);

  const disabled = selected.filter((m) => m.enabled === false).map((m) => m.slug);
  const compact: CompactModsBundle = {
    t: "m",
    v: MODS_BUNDLE_VERSION,
    m: selected.map((m) => {
      if (m.iconUrl) return [m.slug, m.title, m.iconUrl];
      if (m.title) return [m.slug, m.title];
      return [m.slug];
    }),
    d: disabled.length ? disabled : undefined,
    s: settingsFiles.length ? settingsFiles : undefined,
  };

  return Buffer.from(JSON.stringify(compact)).toString("base64");
}

export async function importProfileModsBundle(
  profileId: string,
  bundleData: string
): Promise<{ added: number; skipped: number; settingsAdded: number; settingsSkipped: number }> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error("Profile not found");

  let compact: CompactModsBundle | null = null;
  let legacy: LegacyModsBundle | null = null;
  try {
    const jsonStr = Buffer.from(bundleData, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    if (parsed?.t === "m") {
      compact = parsed as CompactModsBundle;
    } else if (parsed?.type === "mods-bundle") {
      legacy = parsed as LegacyModsBundle;
    }
  } catch {
    throw new Error("Invalid mods bundle data");
  }

  if (!compact && !legacy) {
    throw new Error("Unsupported mods bundle format");
  }

  const bundleMods: ProfileModEntry[] = compact
    ? compact.m.map(([slug, title, iconUrl]) => ({ slug, title, iconUrl }))
    : legacy!.mods;

  const disabled = compact?.d ? new Set(compact.d) : new Set<string>();

  const modsList = loadProfileModList(profile.name);
  const existing = new Map(modsList.map((m) => [m.slug, m]));
  let added = 0;
  let skipped = 0;

  for (const entry of bundleMods) {
    if (!entry?.slug) continue;
    if (existing.has(entry.slug)) {
      skipped += 1;
      continue;
    }
    modsList.push({
      slug: entry.slug,
      title: entry.title,
      iconUrl: entry.iconUrl ?? null,
      enabled: disabled.has(entry.slug) ? false : entry.enabled !== false,
    });
    added += 1;
  }

  if (added > 0) {
    saveProfileModList(profile.name, modsList);
  }

  const templateDir = getProfileTemplateDir(profile.name);
  const configDir = path.join(templateDir, "config");
  let settingsAdded = 0;
  let settingsSkipped = 0;

  const configFiles: ModsBundleFile[] = compact?.s
    ? compact.s
    : Array.isArray(legacy?.settings?.config)
      ? legacy!.settings.config.map((f) => [f.path, f.content] as ModsBundleFile)
      : [];

  if (configFiles.length > 0) {
    for (const file of configFiles) {
      const [relPath, content] = file;
      if (!relPath || !content) continue;
      const targetPath = path.join(configDir, relPath);
      if (fs.existsSync(targetPath)) {
        settingsSkipped += 1;
        continue;
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, Buffer.from(content, "base64"));
      settingsAdded += 1;
    }
  }

  if (isGameRunning()) {
    await queueProfileSync(profileId);
  } else if (added > 0) {
    const installations = await getInstallationsByProfile(profile.name);
    for (const installation of installations) {
      await syncProfileModsToInstallation(profileId, installation.id);
    }
  }

  return { added, skipped, settingsAdded, settingsSkipped };
}
