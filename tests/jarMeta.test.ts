import AdmZip from "adm-zip";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearJarModMetaCache, readJarModMeta } from "../src/main/utils/jarMeta";

const STORED = 0;
const DEFLATED = 8;

let root: string;

function buildJar(files: Record<string, string | Buffer>, options: { method?: number; comment?: string } = {}): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
    if (options.method !== undefined) zip.getEntry(name)!.header.method = options.method;
  }
  if (options.comment) zip.addZipComment(options.comment);
  return zip.toBuffer();
}

function writeJar(name: string, jar: Buffer): string {
  const file = path.join(root, name);
  fs.writeFileSync(file, jar);
  return file;
}

const modJson = (fields: Record<string, unknown>) => JSON.stringify(fields);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "jojo-jarmeta-"));
  clearJarModMetaCache();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("readJarModMeta", () => {
  it.each([
    ["deflated", DEFLATED],
    ["stored", STORED],
  ])("reads a %s fabric.mod.json", async (_, method) => {
    const jar = writeJar(
      "mod.jar",
      buildJar(
        {
          "fabric.mod.json": modJson({ id: "sodium", version: "0.6.0", depends: { minecraft: "1.21.x" } }),
          "net/example/Big.class": Buffer.alloc(64 * 1024, 7),
        },
        { method }
      )
    );

    const meta = await readJarModMeta(jar);

    expect(meta?.fabric).toEqual({ id: "sodium", version: "0.6.0", depends: { minecraft: "1.21.x" } });
    expect(meta?.nested).toEqual([]);
  });

  it("reads the ids of nested jars", async () => {
    const nestedA = buildJar({ "fabric.mod.json": modJson({ id: "fabric-api-base", version: "0.4.1" }) });
    const nestedB = buildJar({ "fabric.mod.json": modJson({ id: "fabric-resource-loader-v0", version: "1.3.0" }) });
    const jar = writeJar(
      "fabric-api.jar",
      buildJar({
        "fabric.mod.json": modJson({
          id: "fabric-api",
          version: "0.100.0",
          jars: [
            { file: "META-INF/jars/a.jar" },
            { file: "META-INF/jars/b.jar" },
            { file: "META-INF/jars/missing.jar" },
          ],
        }),
        "META-INF/jars/a.jar": nestedA,
        "META-INF/jars/b.jar": nestedB,
      })
    );

    const meta = await readJarModMeta(jar);

    expect(meta?.nested).toEqual([
      { id: "fabric-api-base", version: "0.4.1" },
      { id: "fabric-resource-loader-v0", version: "1.3.0" },
    ]);
  });

  it("finds the central directory past an archive comment", async () => {
    const jar = writeJar(
      "commented.jar",
      buildJar({ "fabric.mod.json": modJson({ id: "lithium", version: "1.0" }) }, { comment: "built by loom" })
    );

    expect((await readJarModMeta(jar))?.fabric.id).toBe("lithium");
  });

  it("returns null for a jar without fabric.mod.json", async () => {
    const jar = writeJar("forge.jar", buildJar({ "META-INF/mods.toml": "modId='x'" }));
    expect(await readJarModMeta(jar)).toBeNull();
  });

  it("returns null for invalid fabric.mod.json", async () => {
    const jar = writeJar("broken.jar", buildJar({ "fabric.mod.json": "{ not json" }));
    expect(await readJarModMeta(jar)).toBeNull();
  });

  it("returns null for a file that is not a zip", async () => {
    const jar = writeJar("garbage.jar", Buffer.from("definitely not a zip file"));
    expect(await readJarModMeta(jar)).toBeNull();
  });

  it("returns null for a missing file", async () => {
    expect(await readJarModMeta(path.join(root, "missing.jar"))).toBeNull();
  });

  it("serves unchanged jars from the cache", async () => {
    const jar = writeJar("mod.jar", buildJar({ "fabric.mod.json": modJson({ id: "a", version: "1" }) }));

    const first = await readJarModMeta(jar);
    const second = await readJarModMeta(jar);

    expect(second).toBe(first);
  });

  it("re-reads a jar after it changes", async () => {
    const jar = writeJar("mod.jar", buildJar({ "fabric.mod.json": modJson({ id: "a", version: "1" }) }));
    await readJarModMeta(jar);

    writeJar("mod.jar", buildJar({ "fabric.mod.json": modJson({ id: "a", version: "2.0.0-updated" }) }));

    expect((await readJarModMeta(jar))?.fabric.version).toBe("2.0.0-updated");
  });
});
