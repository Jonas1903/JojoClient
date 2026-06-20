import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { readSettings } from "../utils/storage";
import {
  getMinecraftVersionDetails,
  getFabricVersionDetails,
  isFabricSupported,
  VersionDetails,
  Library,
  ArgumentRule,
} from "./versions";

// =============================================================================
// Types
// =============================================================================

export type DownloadProgress = {
  phase: "preparing" | "libraries" | "assets" | "client" | "done";
  current: number;
  total: number;
  currentFile?: string;
};

export type DownloadResult = {
  clientJar: string;
  libraries: string[];
  assetsDir: string;
  assetIndex: string;
  nativesDir: string;
  mainClass: string;
  mcVersion: string;
  versionId: string;
  fabricVersion: string;
  jvmArgs: string[];
  gameArgs: string[];
};

type DownloadTask = {
  url: string;
  path: string;
  sha1?: string;
  size?: number;
  label?: string;
};

type RequiredLibraryFile = {
  url: string;
  path: string;
  sha1?: string;
  size?: number;
  label: string;
};

const MAX_DOWNLOAD_RETRIES = 3;
const DOWNLOAD_RETRY_BASE_DELAY_MS = 400;

// =============================================================================
// Paths
// =============================================================================

function getBasePath(): string {
  const settings = readSettings();
  if (!settings.basePath) throw new Error("Base path not set");
  return settings.basePath;
}

function getLibrariesDir(): string {
  return path.join(getBasePath(), "libraries");
}

function getAssetsDir(): string {
  return path.join(getBasePath(), "assets");
}

function getVersionsDir(): string {
  return path.join(getBasePath(), "versions");
}

function getNativesDir(version: string): string {
  return path.join(getVersionsDir(), version, "natives");
}

// =============================================================================
// Download Utilities
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function verifyFileWithReason(
  filePath: string,
  expectedSha1?: string,
  expectedSize?: number
): { ok: boolean; reason: string } {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: "file-missing" };
  }

  const stats = fs.statSync(filePath);
  if (expectedSize !== undefined && stats.size !== expectedSize) {
    return {
      ok: false,
      reason: `size-mismatch(expected=${expectedSize},actual=${stats.size})`,
    };
  }

  if (expectedSha1) {
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha1").update(content).digest("hex");
    if (hash !== expectedSha1) {
      return {
        ok: false,
        reason: `sha1-mismatch(expected=${expectedSha1},actual=${hash})`,
      };
    }
  }

  return { ok: true, reason: "ok" };
}

function verifyFile(filePath: string, expectedSha1?: string, expectedSize?: number): boolean {
  return verifyFileWithReason(filePath, expectedSha1, expectedSize).ok;
}

async function atomicReplaceFile(tempPath: string, targetPath: string): Promise<void> {
  try {
    await fs.promises.rename(tempPath, targetPath);
    return;
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code !== "EEXIST" && code !== "EPERM" && code !== "EACCES") {
      throw error;
    }
  }

  await fs.promises.rm(targetPath, { force: true });
  await fs.promises.rename(tempPath, targetPath);
}

async function downloadFile(task: DownloadTask, contextLabel: string): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES; attempt += 1) {
    const tempPath = `${task.path}.tmp.${process.pid}.${Date.now()}.${attempt}`;

    try {
      const response = await fetch(task.url);
      if (!response.ok) {
        throw new Error(`http-${response.status}`);
      }

      const content = Buffer.from(await response.arrayBuffer());
      await fs.promises.mkdir(path.dirname(task.path), { recursive: true });
      await fs.promises.writeFile(tempPath, content);

      const tempValidation = verifyFileWithReason(tempPath, task.sha1, task.size);
      if (!tempValidation.ok) {
        throw new Error(`downloaded-temp-invalid(${tempValidation.reason})`);
      }

      await atomicReplaceFile(tempPath, task.path);

      const finalValidation = verifyFileWithReason(task.path, task.sha1, task.size);
      if (!finalValidation.ok) {
        await fs.promises.rm(task.path, { force: true });
        throw new Error(`downloaded-final-invalid(${finalValidation.reason})`);
      }

      return;
    } catch (error) {
      lastError = error;
      await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);

      if (attempt < MAX_DOWNLOAD_RETRIES) {
        await delay(DOWNLOAD_RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Download failed for ${contextLabel} after ${MAX_DOWNLOAD_RETRIES} attempts. ` +
      `url=${task.url} path=${task.path} reason=${reason}`
  );
}

type ArgumentEntry = string | { value: string | string[]; rules?: ArgumentRule[] };

function shouldUseArgument(rules?: ArgumentRule[], features?: Record<string, boolean>): boolean {
  if (!rules || rules.length === 0) return true;

  const platformName = process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
      ? "osx"
      : "linux";

  let allowed = false;
  for (const rule of rules) {
    let matches = true;

    if (rule.os?.name && rule.os.name !== platformName) {
      matches = false;
    }

    if (rule.os?.arch) {
      if (rule.os.arch === "x86" && process.arch !== "ia32") {
        matches = false;
      } else if (rule.os.arch === "x86_64" && process.arch !== "x64") {
        matches = false;
      } else if (rule.os.arch === "arm64" && process.arch !== "arm64") {
        matches = false;
      }
    }

    if (matches && rule.features) {
      for (const [feature, value] of Object.entries(rule.features)) {
        if ((features?.[feature] ?? false) !== value) {
          matches = false;
          break;
        }
      }
    }

    if (matches) {
      allowed = rule.action === "allow";
    }
  }

  return allowed;
}

function flattenArguments(
  args?: ArgumentEntry[],
  features?: Record<string, boolean>
): string[] {
  if (!args) return [];
  const flat: string[] = [];
  for (const arg of args) {
    if (typeof arg === "string") {
      flat.push(arg);
      continue;
    }
    if (!shouldUseArgument(arg.rules, features)) {
      continue;
    }
    if (Array.isArray(arg.value)) {
      flat.push(...arg.value);
    } else if (typeof arg.value === "string") {
      flat.push(arg.value);
    }
  }
  return flat;
}

function splitLegacyArguments(argString?: string): string[] {
  if (!argString) return [];
  return argString.split(/\s+/g).filter(Boolean);
}

function extractVersionArguments(details: VersionDetails): { jvm: string[]; game: string[] } {
  const featureContext: Record<string, boolean> = {
    is_demo_user: false,
    has_custom_resolution: false,
    has_quick_play: false,
    is_quick_play: false,
  };

  if (details.arguments) {
    return {
      jvm: flattenArguments(details.arguments.jvm, featureContext),
      game: flattenArguments(details.arguments.game, featureContext),
    };
  }

  return {
    jvm: [],
    game: splitLegacyArguments(details.minecraftArguments),
  };
}


// =============================================================================
// Library Handling
// =============================================================================

function shouldUseLibrary(library: Library): boolean {
  if (!library.rules) return true;

  const platformName = process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
      ? "osx"
      : "linux";

  let allowed = false;
  for (const rule of library.rules) {
    let matches = true;

    if (rule.os?.name && rule.os.name !== platformName) {
      matches = false;
    }

    if (rule.os?.arch) {
      if (rule.os.arch === "x86" && process.arch !== "ia32") {
        matches = false;
      } else if (rule.os.arch === "x86_64" && process.arch !== "x64") {
        matches = false;
      } else if (rule.os.arch === "arm64" && process.arch !== "arm64") {
        matches = false;
      }
    }

    if (matches) {
      allowed = rule.action === "allow";
    }
  }

  return allowed;
}

function parseLibraryName(name: string): { groupPath: string; artifactId: string; version: string; classifier?: string } {
  // Format: group:artifact:version or group:artifact:version:classifier
  const parts = name.split(":");
  const groupPath = parts[0].replace(/\./g, "/");
  const artifactId = parts[1];
  const version = parts[2];
  const classifier = parts[3];
  return { groupPath, artifactId, version, classifier };
}

function tokenizeVersion(version: string): Array<number | string> {
  return version
    .toLowerCase()
    .split(/[._+\-]/g)
    .flatMap((part) => part.match(/[a-z]+|\d+/g) || [])
    .map((token) => (/^\d+$/.test(token) ? Number(token) : token));
}

function compareVersionLike(a: string, b: string): number {
  const aTokens = tokenizeVersion(a);
  const bTokens = tokenizeVersion(b);
  const max = Math.max(aTokens.length, bTokens.length);

  const rank = (token: string): number => {
    if (token === "snapshot") return -4;
    if (token === "alpha") return -3;
    if (token === "beta") return -2;
    if (token === "rc") return -1;
    return 0;
  };

  for (let i = 0; i < max; i += 1) {
    const av = aTokens[i];
    const bv = bTokens[i];

    if (av === undefined && bv === undefined) return 0;
    if (av === undefined) return -1;
    if (bv === undefined) return 1;

    if (typeof av === "number" && typeof bv === "number") {
      if (av !== bv) return av > bv ? 1 : -1;
      continue;
    }

    if (typeof av === "number" && typeof bv !== "number") return 1;
    if (typeof av !== "number" && typeof bv === "number") return -1;

    if (av !== bv) {
      const aToken = String(av);
      const bToken = String(bv);
      const aRank = rank(aToken);
      const bRank = rank(bToken);
      if (aRank !== bRank) return aRank > bRank ? 1 : -1;
      const lexical = aToken.localeCompare(bToken);
      if (lexical !== 0) return lexical > 0 ? 1 : -1;
    }
  }

  return 0;
}

function getLibraryCoordinateKey(library: Library): string {
  const { groupPath, artifactId, classifier } = parseLibraryName(library.name);
  return `${groupPath}:${artifactId}:${classifier || ""}`;
}

function dedupeLibrariesByCoordinate(libraries: Library[]): Library[] {
  const selected = new Map<string, Library>();

  for (const library of libraries) {
    const key = getLibraryCoordinateKey(library);
    const existing = selected.get(key);
    if (!existing) {
      selected.set(key, library);
      continue;
    }

    const currentVersion = parseLibraryName(library.name).version;
    const existingVersion = parseLibraryName(existing.name).version;
    if (compareVersionLike(currentVersion, existingVersion) >= 0) {
      selected.set(key, library);
    }
  }

  return Array.from(selected.values());
}

function getLibraryPath(library: Library): string {
  if (library.downloads?.artifact?.path) {
    return library.downloads.artifact.path;
  }

  // Construct path from name
  const { groupPath, artifactId, version, classifier } = parseLibraryName(library.name);
  const fileName = classifier
    ? `${artifactId}-${version}-${classifier}.jar`
    : `${artifactId}-${version}.jar`;
  return `${groupPath}/${artifactId}/${version}/${fileName}`;
}

function getLibraryUrl(library: Library): string {
  if (library.downloads?.artifact?.url) {
    return library.downloads.artifact.url;
  }

  // Construct URL from base URL and path
  const baseUrl = library.url || "https://libraries.minecraft.net/";
  const libPath = getLibraryPath(library);
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  try {
    return new URL(libPath, normalizedBase).toString();
  } catch {
    return `${normalizedBase}${libPath}`;
  }
}

// =============================================================================
// Download Functions
// =============================================================================

async function downloadLibraries(
  libraries: Library[],
  nativesDir: string,
  onProgress: (current: number, total: number, file: string) => void
): Promise<{ classpath: string[]; nativeJars: string[] }> {
  const librariesDir = getLibrariesDir();
  const classpathPaths = new Set<string>();
  const nativeJars = new Set<string>();
  const requiredByPath = new Map<string, RequiredLibraryFile>();

  const registerRequiredFile = (file: RequiredLibraryFile) => {
    const existing = requiredByPath.get(file.path);
    if (!existing) {
      requiredByPath.set(file.path, file);
      return;
    }

    requiredByPath.set(file.path, {
      ...existing,
      sha1: existing.sha1 || file.sha1,
      size: existing.size ?? file.size,
      url: existing.url || file.url,
      label: existing.label || file.label,
    });
  };

  // Build the required file list for this platform and architecture.
  for (const lib of libraries) {
    if (!shouldUseLibrary(lib)) continue;

    const nativeClassifiers = getNativeClassifiers(lib);
    const isExplicitNative = isNativeLibraryName(lib.name);
    let registeredNative = false;

    if (isExplicitNative && isWrongArchLibraryName(lib.name)) {
      continue;
    }

    if (nativeClassifiers.length > 0 && lib.downloads?.classifiers) {
      const classifiers = lib.downloads.classifiers;

      for (const classifier of nativeClassifiers) {
        if (!classifiers[classifier]) continue;
        if (isWrongArchClassifier(classifier)) continue;

        const download = classifiers[classifier];
        const fullPath = path.join(librariesDir, download.path);

        nativeJars.add(fullPath);
        registerRequiredFile({
          url: download.url,
          path: fullPath,
          sha1: download.sha1,
          size: download.size,
          label: `${lib.name}:${classifier}`,
        });
        registeredNative = true;
        break;
      }
    }

    // Explicit native coordinates should never be on classpath.
    if (isExplicitNative) {
      if (!registeredNative) {
        const libPath = getLibraryPath(lib);
        const fullPath = path.join(librariesDir, libPath);
        const url = getLibraryUrl(lib);
        const sha1 = lib.downloads?.artifact?.sha1;
        const size = lib.downloads?.artifact?.size;

        nativeJars.add(fullPath);
        registerRequiredFile({
          url,
          path: fullPath,
          sha1,
          size,
          label: lib.name,
        });
      }
      continue;
    }

    // Some library entries are native-only classifiers without an artifact.
    // Their classpath jar is provided by a sibling entry.
    if (!lib.downloads?.artifact && registeredNative) {
      continue;
    }

    const libPath = getLibraryPath(lib);
    const fullPath = path.join(librariesDir, libPath);
    const url = getLibraryUrl(lib);
    const sha1 = lib.downloads?.artifact?.sha1;
    const size = lib.downloads?.artifact?.size;

    classpathPaths.add(fullPath);

    registerRequiredFile({
      url,
      path: fullPath,
      sha1,
      size,
      label: lib.name,
    });
  }

  const requiredFiles = Array.from(requiredByPath.values());
  const toDownload = requiredFiles
    .filter((file) => !verifyFile(file.path, file.sha1, file.size))
    .map<DownloadTask>((file) => ({
      url: file.url,
      path: file.path,
      sha1: file.sha1,
      size: file.size,
      label: file.label,
    }));

  // Download missing libraries with verification and retries.
  for (let i = 0; i < toDownload.length; i++) {
    const task = toDownload[i];
    onProgress(i + 1, toDownload.length, path.basename(task.path));
    
    try {
      await downloadFile(task, task.label || path.basename(task.path));
    } catch (error) {
      console.error(`Failed to download library: ${task.url}`, error);
      throw error;
    }
  }

  // Final audit: verify everything needed for classpath/natives exists and is valid.
  const invalidFiles = requiredFiles.filter((file) => !verifyFile(file.path, file.sha1, file.size));
  for (let i = 0; i < invalidFiles.length; i++) {
    const file = invalidFiles[i];
    onProgress(i + 1, invalidFiles.length, path.basename(file.path));
    await downloadFile(
      {
        url: file.url,
        path: file.path,
        sha1: file.sha1,
        size: file.size,
        label: file.label,
      },
      file.label
    );
  }

  const unresolved = requiredFiles.find((file) => !verifyFile(file.path, file.sha1, file.size));
  if (unresolved) {
    const reason = verifyFileWithReason(unresolved.path, unresolved.sha1, unresolved.size).reason;
    throw new Error(
      `Library validation failed before launch. label=${unresolved.label} path=${unresolved.path} reason=${reason}`
    );
  }

  extractNatives(Array.from(nativeJars), nativesDir);

  return {
    classpath: Array.from(classpathPaths),
    nativeJars: Array.from(nativeJars),
  };
}

async function downloadAssets(
  versionDetails: VersionDetails,
  onProgress: (current: number, total: number, file: string) => void
): Promise<void> {
  const assetsDir = getAssetsDir();
  const indexDir = path.join(assetsDir, "indexes");
  const objectsDir = path.join(assetsDir, "objects");

  // Download asset index
  const assetIndex = versionDetails.assetIndex;
  const indexPath = path.join(indexDir, `${assetIndex.id}.json`);

  if (!verifyFile(indexPath, assetIndex.sha1, assetIndex.size)) {
    await downloadFile(
      {
        url: assetIndex.url,
        path: indexPath,
        sha1: assetIndex.sha1,
        size: assetIndex.size,
        label: `asset-index:${assetIndex.id}`,
      },
      `asset-index:${assetIndex.id}`
    );
  }

  // Parse asset index
  const indexContent = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  const objects = indexContent.objects as Record<string, { hash: string; size: number }>;
  const objectEntries = Object.entries(objects);

  // Build download tasks
  const tasks: DownloadTask[] = [];
  for (const [, asset] of objectEntries) {
    const hashPrefix = asset.hash.substring(0, 2);
    const objectPath = path.join(objectsDir, hashPrefix, asset.hash);
    const objectUrl = `https://resources.download.minecraft.net/${hashPrefix}/${asset.hash}`;

    if (!verifyFile(objectPath, asset.hash, asset.size)) {
      tasks.push({
        url: objectUrl,
        path: objectPath,
        sha1: asset.hash,
        size: asset.size,
        label: `asset-object:${asset.hash}`,
      });
    }
  }

  // Download missing assets
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    onProgress(i + 1, tasks.length, task.sha1!.substring(0, 8));

    try {
      await downloadFile(task, task.label || task.sha1!.substring(0, 8));
    } catch (error) {
      console.error(`Failed to download asset: ${task.url}`, error);
      // Continue with other assets, some might be optional
    }
  }
}

async function downloadClient(
  versionDetails: VersionDetails,
  versionId: string,
  onProgress: (current: number, total: number, file: string) => void
): Promise<string> {
  const versionsDir = getVersionsDir();
  const versionDir = path.join(versionsDir, versionId);
  const clientPath = path.join(versionDir, `${versionId}.jar`);

  const clientInfo = versionDetails.downloads.client;

  if (!verifyFile(clientPath, clientInfo.sha1, clientInfo.size)) {
    onProgress(0, 1, `${versionId}.jar`);
    await downloadFile(
      {
        url: clientInfo.url,
        path: clientPath,
        sha1: clientInfo.sha1,
        size: clientInfo.size,
        label: `client-jar:${versionId}`,
      },
      `client-jar:${versionId}`
    );
    onProgress(1, 1, `${versionId}.jar`);
  }

  return clientPath;
}

// =============================================================================
// Main Download Function
// =============================================================================

export async function downloadGame(
  mcVersion: string,
  fabricLoaderVersion: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  console.log(`📦 Downloading Minecraft ${mcVersion} with Fabric ${fabricLoaderVersion}...`);

  onProgress({ phase: "preparing", current: 0, total: 0 });

  // Validate the MC version exists
  let mcDetails;
  try {
    mcDetails = await getMinecraftVersionDetails(mcVersion);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Minecraft version ${mcVersion} not found. ${msg}`);
  }

  // Check Fabric support
  const fabricSupported = await isFabricSupported(mcVersion);
  if (!fabricSupported) {
    throw new Error(`Fabric is not available for Minecraft ${mcVersion} yet. This version may be too new or too old for Fabric support.`);
  }

  let fabricDetails;
  try {
    fabricDetails = await getFabricVersionDetails(mcVersion, fabricLoaderVersion);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to get Fabric ${fabricLoaderVersion} for MC ${mcVersion}. ${msg}`);
  }

  const versionId = fabricDetails.id;
  const mergedLibraries = [...mcDetails.libraries, ...fabricDetails.libraries];
  const allLibraries = dedupeLibrariesByCoordinate(mergedLibraries);
  if (allLibraries.length !== mergedLibraries.length) {
    console.log(
      `📚 Deduped libraries by coordinate: ${mergedLibraries.length} -> ${allLibraries.length}`
    );
  }

  console.log(`📚 Downloading ${allLibraries.length} libraries...`);
  const nativesDir = getNativesDir(versionId);
  fs.mkdirSync(nativesDir, { recursive: true });

  const { classpath: libraryPaths } = await downloadLibraries(allLibraries, nativesDir, (current, total, file) => {
    onProgress({ phase: "libraries", current, total, currentFile: file });
  });

  console.log(`🎨 Downloading assets...`);
  await downloadAssets(mcDetails, (current, total, file) => {
    onProgress({ phase: "assets", current, total, currentFile: file });
  });

  console.log(`📦 Downloading client...`);
  const clientJar = await downloadClient(mcDetails, mcVersion, (current, total, file) => {
    onProgress({ phase: "client", current, total, currentFile: file });
  });

  onProgress({ phase: "done", current: 1, total: 1 });
  console.log(`✅ Download complete!`);

  const baseArgs = extractVersionArguments(mcDetails);
  const fabricArgs = {
    jvm: flattenArguments(fabricDetails.arguments?.jvm),
    game: flattenArguments(fabricDetails.arguments?.game),
  };

  return {
    clientJar,
    libraries: libraryPaths,
    assetsDir: getAssetsDir(),
    assetIndex: mcDetails.assetIndex.id,
    nativesDir,
    mainClass: fabricDetails.mainClass,
    mcVersion,
    versionId,
    fabricVersion: fabricLoaderVersion,
    jvmArgs: [...baseArgs.jvm, ...fabricArgs.jvm],
    gameArgs: [...baseArgs.game, ...fabricArgs.game],
  };
}

function getNativeClassifiers(library: Library): string[] {
  if (!library.natives?.windows) return [];

  const candidates: string[] = [];
  const base = library.natives.windows;

  const pushUnique = (value: string) => {
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };

  if (process.platform === "win32") {
    if (process.arch === "x64") {
      pushUnique("natives-windows-x86_64");
      pushUnique("natives-windows-64");
      pushUnique("natives-windows");
    } else if (process.arch === "ia32") {
      pushUnique("natives-windows-x86");
      pushUnique("natives-windows-32");
      pushUnique("natives-windows");
    } else if (process.arch === "arm64") {
      pushUnique("natives-windows-arm64");
      pushUnique("natives-windows");
    }
  }

  if (base.includes("${arch}")) {
    const archToken = process.arch === "x64" ? "64" : process.arch === "ia32" ? "32" : "arm64";
    pushUnique(base.replace("${arch}", archToken));
  } else {
    pushUnique(base);
  }

  return candidates;
}

function isWrongArchClassifier(classifier: string): boolean {
  if (process.platform !== "win32") return false;
  const normalized = classifier.toLowerCase();
  if (process.arch === "x64") {
    return (
      (normalized.includes("x86") && !normalized.includes("x86_64")) ||
      normalized.includes("arm64")
    );
  }
  if (process.arch === "ia32") {
    return normalized.includes("x86_64") || normalized.includes("64") || normalized.includes("arm64");
  }
  return false;
}

function isWrongArchLibraryName(name: string): boolean {
  const classifier = name.split(":")[3]?.toLowerCase() || "";
  return isWrongArchClassifier(classifier);
}

function isNativeLibraryName(name: string): boolean {
  const parts = name.split(":");
  const classifier = parts[3];
  return Boolean(classifier && classifier.toLowerCase().includes("natives"));
}

function nativesDirReady(nativesDir: string): boolean {
  try {
    if (!fs.existsSync(nativesDir)) return false;
    const archFile = path.join(nativesDir, ".arch");
    if (!fs.existsSync(archFile)) return false;
    const arch = fs.readFileSync(archFile, "utf-8").trim();
    if (arch !== process.arch) return false;
    const hasDll = fs.readdirSync(nativesDir).some((file) => file.toLowerCase().endsWith(".dll"));
    return hasDll;
  } catch {
    return false;
  }
}

function extractNatives(nativeJars: string[], nativesDir: string): void {
  if (nativesDirReady(nativesDir)) {
    return;
  }
  if (fs.existsSync(nativesDir)) {
    try {
      fs.rmSync(nativesDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`⚠️ Failed to clear natives dir in use: ${nativesDir}`, e);
      return;
    }
  }
  fs.mkdirSync(nativesDir, { recursive: true });

  const uniqueJars = Array.from(new Set(nativeJars));
  for (const jarPath of uniqueJars) {
    if (!fs.existsSync(jarPath)) continue;

    const zip = new AdmZip(jarPath);
    for (const entry of zip.getEntries()) {
      const entryName = entry.entryName;
      if (entryName.startsWith("META-INF/")) continue;
      if (entry.isDirectory) continue;
      zip.extractEntryTo(entry, nativesDir, false, true);
    }
  }

  fs.writeFileSync(path.join(nativesDir, ".arch"), process.arch, "utf-8");
}

/**
 * Check if a version is already downloaded
 */
export function isVersionDownloaded(mcVersion: string, fabricLoaderVersion?: string): boolean {
  void fabricLoaderVersion; // Reserved for future use
  const versionsDir = getVersionsDir();
  const clientJar = path.join(versionsDir, mcVersion, `${mcVersion}.jar`);
  
  return fs.existsSync(clientJar);
}
