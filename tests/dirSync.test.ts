import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mirrorDirectory } from "../src/main/utils/dirSync";

let root: string;
let src: string;
let dest: string;

function write(base: string, rel: string, content: string): void {
  const file = path.join(base, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function read(base: string, rel: string): string {
  return fs.readFileSync(path.join(base, rel), "utf-8");
}

function exists(base: string, rel: string): boolean {
  return fs.existsSync(path.join(base, rel));
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "jojo-dirsync-"));
  src = path.join(root, "src");
  dest = path.join(root, "dest");
  fs.mkdirSync(src);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("mirrorDirectory", () => {
  it("copies a full tree into a missing destination", async () => {
    write(src, "a.json", "a");
    write(src, "mod/nested/b.json", "b");

    const result = await mirrorDirectory(src, dest);

    expect(read(dest, "a.json")).toBe("a");
    expect(read(dest, "mod/nested/b.json")).toBe("b");
    expect(result).toEqual({ copied: 2, removed: 0, unchanged: 0 });
  });

  it("skips unchanged files on a second run", async () => {
    write(src, "a.json", "a");
    write(src, "mod/b.json", "b");
    await mirrorDirectory(src, dest);

    const result = await mirrorDirectory(src, dest);

    expect(result).toEqual({ copied: 0, removed: 0, unchanged: 2 });
  });

  it("copies a file whose content changed", async () => {
    write(src, "a.json", "old");
    await mirrorDirectory(src, dest);
    write(src, "a.json", "newer");

    const result = await mirrorDirectory(src, dest);

    expect(read(dest, "a.json")).toBe("newer");
    expect(result.copied).toBe(1);
  });

  it("copies a same-size file when only the mtime changed", async () => {
    write(src, "a.json", "aaa");
    await mirrorDirectory(src, dest);
    write(src, "a.json", "bbb");
    const later = new Date(Date.now() + 10_000);
    fs.utimesSync(path.join(src, "a.json"), later, later);

    await mirrorDirectory(src, dest);

    expect(read(dest, "a.json")).toBe("bbb");
  });

  it("removes files and folders that no longer exist in the source", async () => {
    write(src, "keep.json", "k");
    write(dest, "stale.json", "s");
    write(dest, "gone/deep/x.json", "x");

    const result = await mirrorDirectory(src, dest);

    expect(exists(dest, "keep.json")).toBe(true);
    expect(exists(dest, "stale.json")).toBe(false);
    expect(exists(dest, "gone")).toBe(false);
    expect(result.removed).toBe(2);
  });

  it("replaces an entry that changed between file and folder", async () => {
    write(src, "thing/inner.json", "i");
    write(dest, "thing", "was a file");

    await mirrorDirectory(src, dest);

    expect(read(dest, "thing/inner.json")).toBe("i");
  });

  it("neither copies nor deletes excluded paths", async () => {
    write(src, "mod/settings.json", "s");
    write(src, "mod/repo/item.json", "from src");
    write(dest, "mod/repo/item.json", "own copy");
    write(dest, "mod/repo/only-dest.json", "d");

    await mirrorDirectory(src, dest, { exclude: ["MOD/Repo"] });

    expect(read(dest, "mod/settings.json")).toBe("s");
    expect(read(dest, "mod/repo/item.json")).toBe("own copy");
    expect(exists(dest, "mod/repo/only-dest.json")).toBe(true);
  });

  it("does not treat a sibling with a shared prefix as excluded", async () => {
    write(src, "mod/repository.json", "r");

    await mirrorDirectory(src, dest, { exclude: ["mod/repo"] });

    expect(read(dest, "mod/repository.json")).toBe("r");
  });

  it("prunes excluded paths from the destination when asked", async () => {
    write(src, "mod/settings.json", "s");
    write(dest, "mod/repo/item.json", "stale copy");

    await mirrorDirectory(src, dest, { exclude: ["mod/repo"], pruneExcluded: true });

    expect(exists(dest, "mod/repo")).toBe(false);
    expect(read(dest, "mod/settings.json")).toBe("s");
  });

  it("handles more files than the concurrency limit", async () => {
    for (let i = 0; i < 100; i++) write(src, `many/f${i}.json`, String(i));

    const result = await mirrorDirectory(src, dest);

    expect(result.copied).toBe(100);
    expect(read(dest, "many/f99.json")).toBe("99");
  });
});
