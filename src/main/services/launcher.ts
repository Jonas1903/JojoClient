import { spawn, ChildProcess, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { readSettings } from "../utils/storage";
import { getAccount } from "./auth";
import { DownloadResult } from "./download";
import { ensureJava, getBundledJavaPath, JavaProgress } from "./java";

// =============================================================================
// Types
// =============================================================================

export type LaunchOptions = {
  downloadResult: DownloadResult;
  javaPath?: string;
  minMemory?: string;
  maxMemory?: string;
  gameDir?: string;
  width?: number;
  height?: number;
};

export type GameProcess = {
  pid: number;
  kill: () => void;
};

// =============================================================================
// Paths
// =============================================================================

function getBasePath(): string {
  const settings = readSettings();
  if (!settings.basePath) throw new Error("Base path not set");
  return settings.basePath;
}

function getGameDir(): string {
  return path.join(getBasePath(), "minecraft");
}

function parseJavaMajor(versionOutput: string): number | null {
  const versionMatch = versionOutput.match(/version "(\d+)/);
  if (!versionMatch) return null;
  const major = parseInt(versionMatch[1], 10);
  return Number.isNaN(major) ? null : major;
}

function readJavaMajor(javaPath: string): number | null {
  try {
    const output = execSync(`"${javaPath}" -version 2>&1`, { encoding: "utf-8" });
    return parseJavaMajor(output);
  } catch {
    return null;
  }
}

function getRequiredJavaMajor(mcVersion?: string): number {
  if (!mcVersion) return 21;
  const parts = mcVersion.split(".");
  const major = parseInt(parts[0] || "0", 10);
  const minor = parseInt(parts[1] || "0", 10);

  // Minecraft 2.x+ (future proofing)
  if (major > 1) return 21;
  // Minecraft 1.21+ requires Java 21
  if (major === 1 && minor >= 21) return 21;
  // Minecraft 1.18 - 1.20.x requires Java 17
  if (major === 1 && minor >= 18) return 17;
  // Minecraft 1.17.x requires Java 16, but Java 17 works fine
  if (major === 1 && minor >= 17) return 17;
  // Minecraft 1.14.4 - 1.16.x can run on Java 17
  return 17;
}

function isSupportedJava(major: number, required: number): boolean {
  // Java must meet minimum requirement
  // Allow newer Java versions (21, 22, 23, etc.) for forward compatibility
  if (required >= 21) return major >= 21;
  // For Java 17 requirement, allow 17-21 (not newer due to potential compatibility issues with old MC)
  return major >= required && major <= 21;
}

/**
 * Searches for a compatible Java binary on the system. Returns null if none
 * is found (does not throw). The auto-download fallback lives in resolveJavaPath().
 */
function findExistingJava(mcVersion?: string): string | null {
  const requiredMajor = getRequiredJavaMajor(mcVersion);

  // 1. JojoClient-managed runtime (auto-downloaded previously).
  const bundled = getBundledJavaPath(requiredMajor);
  if (bundled) {
    const major = readJavaMajor(bundled);
    if (major !== null && isSupportedJava(major, requiredMajor)) {
      console.log(`✅ Using bundled Java ${major} at: ${bundled}`);
      return bundled;
    }
  }

  // Common Java 17+ installation paths on Windows
  const possiblePaths = [
    // Eclipse Adoptium (Temurin) - most common
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.1.12-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.9.9-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.10.7-hotspot\\bin\\java.exe",
    // Oracle JDK
    "C:\\Program Files\\Java\\jdk-21\\bin\\java.exe",
    "C:\\Program Files\\Java\\jdk-17\\bin\\java.exe",
    // Microsoft OpenJDK
    "C:\\Program Files\\Microsoft\\jdk-21.0.1.12-hotspot\\bin\\java.exe",
    "C:\\Program Files\\Microsoft\\jdk-17.0.9.8-hotspot\\bin\\java.exe",
    // Zulu
    "C:\\Program Files\\Zulu\\zulu-21\\bin\\java.exe",
    "C:\\Program Files\\Zulu\\zulu-17\\bin\\java.exe",
    // BellSoft Liberica
    "C:\\Program Files\\BellSoft\\LibericaJDK-21\\bin\\java.exe",
    "C:\\Program Files\\BellSoft\\LibericaJDK-17\\bin\\java.exe",
  ];

  // First check explicit paths
  for (const javaPath of possiblePaths) {
    if (fs.existsSync(javaPath)) {
      const major = readJavaMajor(javaPath);
      if (major !== null && isSupportedJava(major, requiredMajor)) {
        console.log(`✅ Found Java ${major} at: ${javaPath}`);
        return javaPath;
      }
    }
  }

  // Search in common directories for any Java 17+ installation
  const searchDirs = [
    "C:\\Program Files\\Eclipse Adoptium",
    "C:\\Program Files\\Java",
    "C:\\Program Files\\Microsoft",
    "C:\\Program Files\\Zulu",
    "C:\\Program Files\\BellSoft",
  ];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          // Look for jdk-17, jdk-21, jdk-22, jdk-23, jdk-24, jdk-25, etc.
          if (entry.match(/jdk-(1[7-9]|2[0-9])/)) {
            const javaExe = path.join(dir, entry, "bin", "java.exe");
            if (fs.existsSync(javaExe)) {
              const major = readJavaMajor(javaExe);
              if (major !== null && isSupportedJava(major, requiredMajor)) {
                console.log(`✅ Found Java ${major} at: ${javaExe}`);
                return javaExe;
              }
            }
          }
        }
      } catch {
        // Ignore directory read errors
      }
    }
  }

  // Try to check if java in PATH is version 17+ (and compatible with this MC version)
  try {
    const versionOutput = execSync("java -version 2>&1", { encoding: "utf-8" });
    const majorVersion = parseJavaMajor(versionOutput);
    if (majorVersion !== null) {
      if (isSupportedJava(majorVersion, requiredMajor)) {
        console.log(`✅ Found Java ${majorVersion} in PATH`);
        return "java";
      }
      console.log(`⚠️ Java in PATH is version ${majorVersion}, need Java ${requiredMajor}`);
    }
  } catch {
    // java not in PATH
  }

  return null;
}

/**
 * Resolves a Java binary for the given MC version. Checks the runtime folder
 * and the system, and auto-downloads Adoptium Temurin if nothing is found.
 */
export async function resolveJavaPath(
  mcVersion: string | undefined,
  onJavaProgress?: (p: JavaProgress) => void
): Promise<string> {
  const requiredMajor = getRequiredJavaMajor(mcVersion);
  return ensureJava(
    requiredMajor,
    () => findExistingJava(mcVersion),
    (p) => onJavaProgress?.(p)
  );
}

// =============================================================================
// Launch Argument Building
// =============================================================================

function buildClasspath(clientJar: string, libraries: string[]): string {
  // Windows uses semicolon as path separator
  const allPaths = Array.from(new Set([...libraries, clientJar]));
  return allPaths.join(";");
}

function resolveArgPlaceholders(arg: string, context: Record<string, string>): string {
  return arg.replace(/\$\{([^}]+)\}/g, (_match, key) => context[key] ?? _match);
}

function resolveArgs(args: string[], context: Record<string, string>): string[] {
  return args.map((arg) => resolveArgPlaceholders(arg, context));
}

function filterJvmArgs(args: string[]): string[] {
  const blockedPrefixes = [
    "-Djava.library.path=",
    "-Dorg.lwjgl.librarypath=",
  ];
  const blockedExact = new Set(["-XstartOnFirstThread"]);
  const filtered: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-cp" || arg === "--class-path") {
      i += 1;
      continue;
    }
    if (blockedExact.has(arg)) {
      continue;
    }
    if (blockedPrefixes.some((prefix) => arg.startsWith(prefix))) {
      continue;
    }
    filtered.push(arg);
  }

  return filtered;
}

function mergeGameArgs(baseArgs: string[], extraArgs: string[]): string[] {
  const merged = [...baseArgs];
  const existingKeys = new Set<string>();

  for (let i = 0; i < baseArgs.length; i += 1) {
    const arg = baseArgs[i];
    if (arg.startsWith("--")) {
      existingKeys.add(arg);
    }
  }

  for (let i = 0; i < extraArgs.length; i += 1) {
    const arg = extraArgs[i];
    if (arg.startsWith("--")) {
      if (existingKeys.has(arg)) {
        if (i + 1 < extraArgs.length && !extraArgs[i + 1].startsWith("--")) {
          i += 1;
        }
        continue;
      }
      existingKeys.add(arg);
    }
    merged.push(arg);
  }

  return merged;
}

function stripQuickPlayArgs(args: string[]): string[] {
  const quickPlayFlags = new Set([
    "--quickPlayPath",
    "--quickPlaySingleplayer",
    "--quickPlayMultiplayer",
    "--quickPlayRealms",
    "--quick-play-path",
    "--quick-play-singleplayer",
    "--quick-play-multiplayer",
    "--quick-play-realms",
  ]);

  const filtered: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (quickPlayFlags.has(arg)) {
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        i += 1;
      }
      continue;
    }
    filtered.push(arg);
  }
  return filtered;
}

function buildJvmArgs(options: LaunchOptions, classpath: string): string[] {
  const nativesDir = options.downloadResult.nativesDir;
  const minMem = options.minMemory || "512M";
  const maxMem = options.maxMemory || "2G";

  const baseArgs = [
    `-Xms${minMem}`,
    `-Xmx${maxMem}`,
    `-Djava.library.path=${nativesDir}`,
    `-Dorg.lwjgl.librarypath=${nativesDir}`,
    "-Dminecraft.launcher.brand=JojoClient",
    "-Dminecraft.launcher.version=1.0.0",
    "-cp",
    classpath,
  ];

  const context = {
    natives_directory: nativesDir,
    launcher_name: "JojoClient",
    launcher_version: "1.0.0",
    classpath,
  };

  const resolvedExtra = resolveArgs(options.downloadResult.jvmArgs || [], context);
  const filteredExtra = filterJvmArgs(resolvedExtra);

  return [...baseArgs, ...filteredExtra];
}

async function buildGameArgs(options: LaunchOptions): Promise<string[]> {
  const account = await getAccount();
  if (!account) {
    throw new Error("Not logged in. Please log in first.");
  }

  const gameDir = options.gameDir || getGameDir();
  const assetsDir = options.downloadResult.assetsDir;
  const assetIndex = options.downloadResult.assetIndex;
  const mcVersion = options.downloadResult.mcVersion;

  // Create game directory if it doesn't exist
  fs.mkdirSync(gameDir, { recursive: true });

  const width = options.width || 854;
  const height = options.height || 480;

  const baseArgs = [
    "--username", account.username,
    "--version", mcVersion,
    "--gameDir", gameDir,
    "--assetsDir", assetsDir,
    "--assetIndex", assetIndex,
    "--uuid", account.uuid,
    "--accessToken", account.accessToken,
    "--xuid", account.xuid || "",
    "--clientId", "00000000402b5328",
    "--userType", "msa",
    "--versionType", "release",
    "--width", String(width),
    "--height", String(height),
  ];

  const context = {
    auth_player_name: account.username,
    version_name: options.downloadResult.versionId || mcVersion,
    game_directory: gameDir,
    assets_root: assetsDir,
    assets_index_name: assetIndex,
    auth_uuid: account.uuid,
    auth_access_token: account.accessToken,
    auth_xuid: account.xuid || "",
    clientid: "00000000402b5328",
    user_type: "msa",
    version_type: "release",
  };

  const resolvedExtra = resolveArgs(options.downloadResult.gameArgs || [], context);
  const merged = mergeGameArgs(baseArgs, resolvedExtra);
  return stripQuickPlayArgs(merged);
}

// =============================================================================
// Game Launch
// =============================================================================

const gameProcesses = new Map<number, ChildProcess>();

export async function launchGame(
  options: LaunchOptions,
  onLog: (line: string) => void,
  onExit: (code: number | null) => void,
  onJavaProgress?: (p: JavaProgress) => void
): Promise<GameProcess> {
  const javaPath =
    options.javaPath ||
    (await resolveJavaPath(options.downloadResult.mcVersion, onJavaProgress));
  const classpath = buildClasspath(
    options.downloadResult.clientJar,
    options.downloadResult.libraries
  );
  const jvmArgs = buildJvmArgs(options, classpath);
  const gameArgs = await buildGameArgs(options);
  const mainClass = options.downloadResult.mainClass;

  const allArgs = [...jvmArgs, mainClass, ...gameArgs];

  console.log("🎮 Launching Minecraft...");
  console.log(`Java: ${javaPath}`);
  console.log(`Main class: ${mainClass}`);
  console.log(`Game args: ${gameArgs.join(" ")}`);

  const gameProcess = spawn(javaPath, allArgs, {
    cwd: options.gameDir || getGameDir(),
    detached: false,
  });

  if (gameProcess.pid) {
    gameProcesses.set(gameProcess.pid, gameProcess);
  }

  // Handle stdout
  gameProcess.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        onLog(`[OUT] ${line}`);
      }
    }
  });

  // Handle stderr
  gameProcess.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        onLog(`[ERR] ${line}`);
      }
    }
  });

  // Handle exit
  gameProcess.on("exit", (code) => {
    console.log(`🎮 Game exited with code ${code}`);
    if (gameProcess.pid) {
      gameProcesses.delete(gameProcess.pid);
    }
    onExit(code);
  });

  // Handle errors
  gameProcess.on("error", (error) => {
    console.error("🎮 Game process error:", error);
    onLog(`[ERROR] ${error.message}`);
    if (gameProcess.pid) {
      gameProcesses.delete(gameProcess.pid);
    }
    onExit(-1);
  });

  return {
    pid: gameProcess.pid!,
    kill: () => {
      if (gameProcess && !gameProcess.killed) {
        gameProcess.kill();
      }
    },
  };
}

export function isGameRunning(): boolean {
  return Array.from(gameProcesses.values()).some((proc) => !proc.killed);
}

export function killGame(): void {
  for (const [pid, proc] of gameProcesses.entries()) {
    if (!proc.killed) {
      proc.kill();
    }
    gameProcesses.delete(pid);
  }
}
