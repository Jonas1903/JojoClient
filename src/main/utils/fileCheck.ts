// Integrity checks for downloaded game files (libraries, assets, client JAR).
//
// Downloads are hash-checked in memory, written to a temp file and renamed into
// place, so a file at its final path was complete and correct when written. On
// launch it is enough to check that each file still exists with the expected size;
// re-hashing ~500 MB of assets on every launch blocked the main thread for seconds.

import * as fs from "fs";
import * as crypto from "crypto";

export type FileCheck = { ok: boolean; reason: string };

/** Checks freshly downloaded bytes against the expected size and SHA-1. */
export function checkContent(content: Buffer, expectedSha1?: string, expectedSize?: number): FileCheck {
  if (expectedSize !== undefined && content.length !== expectedSize) {
    return {
      ok: false,
      reason: `size-mismatch(expected=${expectedSize},actual=${content.length})`,
    };
  }

  if (expectedSha1) {
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

/** Launch-time check: the file exists and has the expected size. Never reads the file. */
export async function checkFileOnDisk(filePath: string, expectedSize?: number): Promise<FileCheck> {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, reason: "file-missing" };
    }
    throw e;
  }

  if (!stats.isFile()) {
    return { ok: false, reason: "not-a-file" };
  }
  if (expectedSize !== undefined && stats.size !== expectedSize) {
    return {
      ok: false,
      reason: `size-mismatch(expected=${expectedSize},actual=${stats.size})`,
    };
  }

  return { ok: true, reason: "ok" };
}

// Checking all ~5k assets at once settles thousands of promises in one burst and
// stalls the event loop; batches keep each stall short.
const CHECK_BATCH_SIZE = 256;

/** Returns the files that fail checkFileOnDisk, checking them concurrently in batches. */
export async function findInvalidFiles<T extends { path: string; size?: number }>(
  files: readonly T[]
): Promise<T[]> {
  const invalid: T[] = [];
  for (let start = 0; start < files.length; start += CHECK_BATCH_SIZE) {
    const batch = files.slice(start, start + CHECK_BATCH_SIZE);
    const results = await Promise.all(batch.map((file) => checkFileOnDisk(file.path, file.size)));
    batch.forEach((file, i) => {
      if (!results[i].ok) invalid.push(file);
    });
  }
  return invalid;
}
