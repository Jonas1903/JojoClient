// Reads fabric.mod.json (and the fabric.mod.json of nested JARs) from mod JARs.
//
// AdmZip loads the whole JAR into memory synchronously, which blocked the main
// thread for over a second per launch with ~50 mods. This reader only fetches the
// ZIP central directory and the entries it needs, asynchronously, and caches the
// result per file path, size and mtime, so unchanged JARs are never reopened.

import * as fs from "fs";
import * as zlib from "zlib";
import { promisify } from "util";
import AdmZip from "adm-zip";

const inflateRaw = promisify(zlib.inflateRaw);

export type FabricModJson = {
  id?: string;
  version?: string;
  name?: string;
  depends?: Record<string, string | string[]>;
  provides?: string[];
  jars?: Array<{ file: string }>;
};

export type JarModMeta = {
  fabric: FabricModJson;
  // Sub-mods bundled under META-INF/jars (Fabric API ships dozens this way).
  nested: Array<{ id: string; version: string }>;
};

type ZipSource = {
  size: number;
  read(offset: number, length: number): Promise<Buffer>;
};

type ZipEntry = {
  method: number;
  flags: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 0x1;

function bufferSource(buffer: Buffer): ZipSource {
  return {
    size: buffer.length,
    read: async (offset, length) => buffer.subarray(offset, offset + length),
  };
}

function fileSource(handle: fs.promises.FileHandle, size: number): ZipSource {
  return {
    size,
    read: async (offset, length) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    },
  };
}

// Throws on anything it does not handle (ZIP64, encryption, odd methods); the
// caller then falls back to AdmZip.
async function readCentralDirectory(source: ZipSource): Promise<Map<string, ZipEntry>> {
  const tailLength = Math.min(source.size, EOCD_MIN_SIZE + MAX_COMMENT_SIZE);
  const tail = await source.read(source.size - tailLength, tailLength);

  let eocd = -1;
  for (let i = tail.length - EOCD_MIN_SIZE; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip: end of central directory not found");

  const entryCount = tail.readUInt16LE(eocd + 10);
  const cdSize = tail.readUInt32LE(eocd + 12);
  const cdOffset = tail.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error("zip: ZIP64 not supported");
  }

  const cd = await source.read(cdOffset, cdSize);
  const entries = new Map<string, ZipEntry>();
  let pos = 0;
  for (let i = 0; i < entryCount; i++) {
    if (pos + 46 > cd.length || cd.readUInt32LE(pos) !== CENTRAL_SIGNATURE) {
      throw new Error("zip: malformed central directory");
    }
    const nameLength = cd.readUInt16LE(pos + 28);
    const extraLength = cd.readUInt16LE(pos + 30);
    const commentLength = cd.readUInt16LE(pos + 32);
    const name = cd.toString("utf8", pos + 46, pos + 46 + nameLength);
    entries.set(name, {
      flags: cd.readUInt16LE(pos + 8),
      method: cd.readUInt16LE(pos + 10),
      compressedSize: cd.readUInt32LE(pos + 20),
      localHeaderOffset: cd.readUInt32LE(pos + 42),
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readEntry(source: ZipSource, entry: ZipEntry): Promise<Buffer> {
  if (entry.flags & FLAG_ENCRYPTED) throw new Error("zip: encrypted entry");

  const header = await source.read(entry.localHeaderOffset, 30);
  if (header.length < 30 || header.readUInt32LE(0) !== LOCAL_SIGNATURE) {
    throw new Error("zip: malformed local header");
  }
  // The local extra field can differ from the central one, so use its own lengths.
  const dataOffset = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const data = await source.read(dataOffset, entry.compressedSize);

  if (entry.method === METHOD_STORED) return data;
  if (entry.method === METHOD_DEFLATE) return inflateRaw(data);
  throw new Error(`zip: unsupported compression method ${entry.method}`);
}

async function readFabricJson(
  source: ZipSource,
  entries: Map<string, ZipEntry>
): Promise<FabricModJson | null> {
  const entry = entries.get("fabric.mod.json");
  if (!entry) return null;
  return JSON.parse((await readEntry(source, entry)).toString("utf8")) as FabricModJson;
}

async function readMetaFromSource(source: ZipSource): Promise<JarModMeta | null> {
  const entries = await readCentralDirectory(source);
  const fabric = await readFabricJson(source, entries);
  if (!fabric) return null;

  const nested: JarModMeta["nested"] = [];
  for (const jar of Array.isArray(fabric.jars) ? fabric.jars : []) {
    const entry = typeof jar?.file === "string" ? entries.get(jar.file) : undefined;
    if (!entry) continue;
    try {
      const nestedSource = bufferSource(await readEntry(source, entry));
      const parsed = await readFabricJson(nestedSource, await readCentralDirectory(nestedSource));
      if (parsed?.id && parsed.version) nested.push({ id: parsed.id, version: parsed.version });
    } catch {
      // Skip unreadable nested JARs
    }
  }
  return { fabric, nested };
}

// Slow path for JARs the streaming reader rejects. Same result shape.
function readMetaWithAdmZip(buffer: Buffer): JarModMeta | null {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry("fabric.mod.json");
  if (!entry) return null;
  const fabric = JSON.parse(zip.readAsText(entry)) as FabricModJson;

  const nested: JarModMeta["nested"] = [];
  for (const jar of Array.isArray(fabric.jars) ? fabric.jars : []) {
    try {
      const nestedEntry = typeof jar?.file === "string" ? zip.getEntry(jar.file) : null;
      if (!nestedEntry) continue;
      const nestedZip = new AdmZip(nestedEntry.getData());
      const nestedMeta = nestedZip.getEntry("fabric.mod.json");
      if (!nestedMeta) continue;
      const parsed = JSON.parse(nestedZip.readAsText(nestedMeta)) as FabricModJson;
      if (parsed.id && parsed.version) nested.push({ id: parsed.id, version: parsed.version });
    } catch {
      // Skip unreadable nested JARs
    }
  }
  return { fabric, nested };
}

async function readJarModMetaUncached(jarPath: string, size: number): Promise<JarModMeta | null> {
  try {
    const handle = await fs.promises.open(jarPath, "r");
    try {
      return await readMetaFromSource(fileSource(handle, size));
    } finally {
      await handle.close();
    }
  } catch (e) {
    if (e instanceof SyntaxError) return null; // fabric.mod.json is not valid JSON
  }
  try {
    return readMetaWithAdmZip(await fs.promises.readFile(jarPath));
  } catch {
    return null;
  }
}

type CacheEntry = { size: number; mtimeMs: number; meta: Promise<JarModMeta | null> };

const cache = new Map<string, CacheEntry>();

/**
 * Returns the Fabric metadata of a mod JAR, or null when it is not a readable
 * Fabric mod. Results are cached until the file's size or mtime changes.
 */
export async function readJarModMeta(jarPath: string): Promise<JarModMeta | null> {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(jarPath);
  } catch {
    cache.delete(jarPath);
    return null;
  }

  const cached = cache.get(jarPath);
  if (cached && cached.size === stats.size && cached.mtimeMs === stats.mtimeMs) {
    return cached.meta;
  }

  const meta = readJarModMetaUncached(jarPath, stats.size);
  cache.set(jarPath, { size: stats.size, mtimeMs: stats.mtimeMs, meta });
  return meta;
}

/** Drops all cached metadata. Exposed for tests. */
export function clearJarModMetaCache(): void {
  cache.clear();
}
