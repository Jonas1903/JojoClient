import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkContent, checkFileOnDisk, findInvalidFiles } from "../src/main/utils/fileCheck";

const sha1 = (data: Buffer) => crypto.createHash("sha1").update(data).digest("hex");

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "jojo-filecheck-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("checkContent", () => {
  const data = Buffer.from("asset bytes");

  it("accepts bytes with the expected size and hash", () => {
    expect(checkContent(data, sha1(data), data.length)).toEqual({ ok: true, reason: "ok" });
  });

  it("rejects a size mismatch", () => {
    const result = checkContent(data, sha1(data), data.length + 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/^size-mismatch/);
  });

  it("rejects a hash mismatch", () => {
    const result = checkContent(data, sha1(Buffer.from("other")), data.length);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/^sha1-mismatch/);
  });

  it("accepts anything when nothing is expected", () => {
    expect(checkContent(data).ok).toBe(true);
  });
});

describe("checkFileOnDisk", () => {
  it("accepts an existing file with the expected size", async () => {
    const file = path.join(root, "lib.jar");
    fs.writeFileSync(file, "12345");
    expect(await checkFileOnDisk(file, 5)).toEqual({ ok: true, reason: "ok" });
  });

  it("accepts an existing file when no size is known", async () => {
    const file = path.join(root, "lib.jar");
    fs.writeFileSync(file, "12345");
    expect((await checkFileOnDisk(file)).ok).toBe(true);
  });

  it("reports a missing file", async () => {
    expect(await checkFileOnDisk(path.join(root, "missing.jar"), 5)).toEqual({
      ok: false,
      reason: "file-missing",
    });
  });

  it("reports a truncated file", async () => {
    const file = path.join(root, "lib.jar");
    fs.writeFileSync(file, "123");
    const result = await checkFileOnDisk(file, 5);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("size-mismatch(expected=5,actual=3)");
  });

  it("rejects a folder in place of the file", async () => {
    const dir = path.join(root, "lib.jar");
    fs.mkdirSync(dir);
    expect((await checkFileOnDisk(dir)).reason).toBe("not-a-file");
  });
});

describe("findInvalidFiles", () => {
  it("returns only the missing and wrong-size files, in order", async () => {
    fs.writeFileSync(path.join(root, "good"), "1234");
    fs.writeFileSync(path.join(root, "short"), "12");
    const files = [
      { path: path.join(root, "good"), size: 4, label: "good" },
      { path: path.join(root, "missing"), size: 4, label: "missing" },
      { path: path.join(root, "short"), size: 4, label: "short" },
    ];

    const invalid = await findInvalidFiles(files);

    expect(invalid.map((f) => f.label)).toEqual(["missing", "short"]);
  });
});
