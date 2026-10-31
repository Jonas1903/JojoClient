// Incremental, async directory mirroring for the template <-> installation config
// sync. Replaces "rm -rf dest, then copy src" so an unchanged config folder costs
// a stat walk instead of a full rewrite, and never blocks the Electron main thread.

import * as fs from "fs";
import * as path from "path";

export type MirrorOptions = {
  // Paths relative to the mirrored root, with "/" separators, matched
  // case-insensitively. An excluded path and everything under it is never copied,
  // and is left alone in dest unless pruneExcluded is set.
  exclude?: readonly string[];
  pruneExcluded?: boolean;
};

export type MirrorResult = {
  copied: number;
  removed: number;
  unchanged: number;
};

const FILE_OP_CONCURRENCY = 16;
// Copied files get src's mtime; the round trip through utimes can lose sub-ms precision.
const MTIME_TOLERANCE_MS = 1;

type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

function createLimiter(max: number): Limiter {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async (fn) => {
    if (active < max) {
      active++;
    } else {
      // The releasing task hands its slot over, so active stays unchanged.
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

async function readDirOrEmpty(dir: string): Promise<fs.Dirent[]> {
  try {
    return await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function statOrNull(filePath: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.stat(filePath);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/**
 * Makes dest an exact copy of src (minus excluded paths): files that differ in
 * size or mtime are copied, files and folders missing from src are removed, and
 * unchanged files are not touched.
 */
export async function mirrorDirectory(
  src: string,
  dest: string,
  options: MirrorOptions = {}
): Promise<MirrorResult> {
  const result: MirrorResult = { copied: 0, removed: 0, unchanged: 0 };
  const excludes = (options.exclude ?? []).map((p) => p.replace(/\\/g, "/").toLowerCase());
  const limit = createLimiter(FILE_OP_CONCURRENCY);

  const isExcluded = (rel: string) => {
    const key = rel.toLowerCase();
    return excludes.some((p) => key === p || key.startsWith(`${p}/`));
  };

  const remove = (target: string) =>
    limit(async () => {
      await fs.promises.rm(target, { recursive: true, force: true });
      result.removed++;
    });

  const syncFile = (srcPath: string, destPath: string) =>
    limit(async () => {
      const srcStat = await fs.promises.stat(srcPath);
      if (!srcStat.isFile()) return;
      const destStat = await statOrNull(destPath);
      if (
        destStat?.isFile() &&
        destStat.size === srcStat.size &&
        Math.abs(destStat.mtimeMs - srcStat.mtimeMs) < MTIME_TOLERANCE_MS
      ) {
        result.unchanged++;
        return;
      }
      await fs.promises.copyFile(srcPath, destPath);
      await fs.promises.utimes(destPath, srcStat.atimeMs / 1000, srcStat.mtimeMs / 1000);
      result.copied++;
    });

  const mirrorDir = async (srcDir: string, destDir: string, rel: string): Promise<void> => {
    await fs.promises.mkdir(destDir, { recursive: true });
    const [srcEntries, destEntries] = await Promise.all([
      fs.promises.readdir(srcDir, { withFileTypes: true }),
      readDirOrEmpty(destDir),
    ]);
    const srcByName = new Map(srcEntries.map((e) => [e.name, e]));
    const relOf = (name: string) => (rel ? `${rel}/${name}` : name);

    // Clear stale entries first, including ones whose kind changed (file <-> folder),
    // so the copies below never collide with them.
    await Promise.all(
      destEntries.map((entry) => {
        const target = path.join(destDir, entry.name);
        if (isExcluded(relOf(entry.name))) {
          return options.pruneExcluded ? remove(target) : undefined;
        }
        const srcEntry = srcByName.get(entry.name);
        if (!srcEntry || srcEntry.isDirectory() !== entry.isDirectory()) {
          return remove(target);
        }
        return undefined;
      })
    );

    await Promise.all(
      srcEntries.map((entry) => {
        if (isExcluded(relOf(entry.name))) return undefined;
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) return mirrorDir(srcPath, destPath, relOf(entry.name));
        return syncFile(srcPath, destPath);
      })
    );
  };

  await mirrorDir(src, dest, "");
  return result;
}
