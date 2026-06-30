import fs from "fs";
import path from "path";
import https from "https";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { URL } from "url";
import { readSettings } from "../utils/storage";

// =============================================================================
// Java Runtime Manager
//
// Auto-downloads the correct Adoptium Temurin JDK into basePath/runtime/jdk-{major}
// when no compatible system Java is detected. Windows x64 only — other platforms
// throw a clear error.
// =============================================================================

export type JavaProgress = {
  phase: "java-resolve" | "java-download" | "java-extract" | "java-done";
  current: number;
  total: number;
  currentFile?: string;
};

type AdoptiumAsset = {
  binary: {
    package: {
      link: string;
      name: string;
      checksum: string;
      size: number;
    };
  };
  release_name: string;
};

function getBasePath(): string | null {
  const settings = readSettings();
  return settings.basePath || null;
}

function getRuntimeDir(): string | null {
  const basePath = getBasePath();
  if (!basePath) return null;
  return path.join(basePath, "runtime");
}

function getJdkRoot(major: number): string | null {
  const runtimeDir = getRuntimeDir();
  if (!runtimeDir) return null;
  return path.join(runtimeDir, `jdk-${major}`);
}

/**
 * Returns the bundled `java.exe` for the given major version if it has been
 * downloaded into the JojoClient runtime folder.
 */
export function getBundledJavaPath(major: number): string | null {
  const root = getJdkRoot(major);
  if (!root || !fs.existsSync(root)) return null;

  // Adoptium extracts to a folder like jdk-21.0.5+11/bin/java.exe
  // We flatten to runtime/jdk-{major}/bin/java.exe after install.
  const flatExe = path.join(root, "bin", "java.exe");
  if (fs.existsSync(flatExe)) return flatExe;

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nestedExe = path.join(root, entry.name, "bin", "java.exe");
        if (fs.existsSync(nestedExe)) return nestedExe;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// =============================================================================
// Adoptium API
// =============================================================================

function httpGetJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "JojoClient" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpGetJson<T>(res.headers.location).then(resolve, reject);
          res.resume();
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T);
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error("Adoptium API timeout")));
  });
}

function downloadToFile(
  url: string,
  destPath: string,
  expectedSize: number | undefined,
  onProgress: (downloaded: number, total: number) => void,
  redirectsLeft = 5
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.get(
      {
        host: parsed.host,
        path: parsed.pathname + parsed.search,
        headers: { "User-Agent": "JojoClient" },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error("Too many redirects downloading JDK"));
            return;
          }
          downloadToFile(res.headers.location, destPath, expectedSize, onProgress, redirectsLeft - 1)
            .then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading JDK from ${url}`));
          res.resume();
          return;
        }

        const total =
          expectedSize ?? (parseInt(String(res.headers["content-length"] ?? "0"), 10) || 0);
        let downloaded = 0;
        const out = fs.createWriteStream(destPath);
        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          onProgress(downloaded, total);
        });
        res.pipe(out);
        out.on("finish", () => out.close(() => resolve()));
        out.on("error", reject);
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(120_000, () =>
      req.destroy(new Error("JDK download timed out (no data for 120s)"))
    );
  });
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// =============================================================================
// Install
// =============================================================================

async function downloadAdoptiumJdk(
  major: number,
  onProgress: (p: JavaProgress) => void
): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error(
      `Automatic Java install is currently Windows-only. Please install Java ${major} manually from https://adoptium.net/`
    );
  }

  onProgress({ phase: "java-resolve", current: 0, total: 1, currentFile: `Adoptium Temurin ${major}` });

  const apiUrl =
    `https://api.adoptium.net/v3/assets/latest/${major}/hotspot` +
    `?architecture=x64&image_type=jdk&os=windows&vendor=eclipse`;

  const assets = await httpGetJson<AdoptiumAsset[]>(apiUrl);
  if (!assets || assets.length === 0) {
    throw new Error(`No Adoptium release found for Java ${major}.`);
  }
  // Prefer a .zip package (Windows). Adoptium returns .zip for windows/x64/jdk.
  const asset =
    assets.find((a) => a.binary?.package?.name?.toLowerCase().endsWith(".zip")) ?? assets[0];
  const pkg = asset.binary?.package;
  if (!pkg?.link) {
    throw new Error(`Adoptium asset for Java ${major} is missing a download link.`);
  }

  const runtimeDir = getRuntimeDir();
  if (!runtimeDir) {
    throw new Error("Base path not configured. Please set up your JojoClient folder first.");
  }
  fs.mkdirSync(runtimeDir, { recursive: true });

  const downloadName = pkg.name || `temurin-${major}.zip`;
  const archivePath = path.join(runtimeDir, downloadName);

  await downloadToFile(pkg.link, archivePath, pkg.size, (downloaded, total) => {
    onProgress({
      phase: "java-download",
      current: downloaded,
      total: total || pkg.size || 0,
      currentFile: `Java ${major} (${downloadName})`,
    });
  });

  if (pkg.checksum) {
    const actual = await sha256File(archivePath);
    if (actual.toLowerCase() !== pkg.checksum.toLowerCase()) {
      try {
        fs.unlinkSync(archivePath);
      } catch {
        /* ignore */
      }
      throw new Error(
        `Java ${major} download checksum mismatch. Expected ${pkg.checksum}, got ${actual}.`
      );
    }
  }

  onProgress({
    phase: "java-extract",
    current: 0,
    total: 1,
    currentFile: `Java ${major}`,
  });

  const targetRoot = getJdkRoot(major);
  if (!targetRoot) {
    throw new Error("Base path not configured. Cannot install Java runtime.");
  }
  // Clean previous attempt to avoid mixing two JDK versions.
  if (fs.existsSync(targetRoot)) {
    fs.rmSync(targetRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(targetRoot, { recursive: true });

  const zip = new AdmZip(archivePath);
  zip.extractAllTo(targetRoot, true);

  try {
    fs.unlinkSync(archivePath);
  } catch {
    /* ignore */
  }

  const javaExe = getBundledJavaPath(major);
  if (!javaExe) {
    throw new Error(
      `Java ${major} extracted but java.exe was not found under ${targetRoot}.`
    );
  }

  onProgress({ phase: "java-done", current: 1, total: 1, currentFile: `Java ${major}` });
  return javaExe;
}

/**
 * Returns a path to a Java binary that satisfies the required major version.
 * Resolution order:
 *   1. Previously installed JojoClient runtime (basePath/runtime/jdk-{major})
 *   2. systemFallback() — usually the existing findJava() in launcher.ts
 *   3. Auto-download from Adoptium Temurin into the runtime folder
 */
export async function ensureJava(
  requiredMajor: number,
  systemFallback: () => Promise<string | null>,
  onProgress: (p: JavaProgress) => void
): Promise<string> {
  const bundled = getBundledJavaPath(requiredMajor);
  if (bundled) return bundled;

  const system = await systemFallback();
  if (system) return system;

  return downloadAdoptiumJdk(requiredMajor, onProgress);
}
