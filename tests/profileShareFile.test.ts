import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectProfileFiles, collectTemplateFiles } from "../src/main/services/profileSerializer";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue("C:\\test\\appdata"),
  },
}));

function write(filePath: string, content = "x") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("profile share file contents", () => {
  let root: string;
  let profileDir: string;
  let templateDir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "jojo-share-"));
    profileDir = path.join(root, "MyProfile");
    templateDir = path.join(profileDir, "template");

    write(path.join(profileDir, "mods.json"), JSON.stringify({ mods: [{ slug: "sodium" }] }));
    write(path.join(profileDir, "pending-sync.json"), "{}");
    write(path.join(profileDir, "mods", "cached.jar"));
    write(path.join(profileDir, "installations", "index.json"), "{}");

    write(path.join(templateDir, "options.txt"), "key_key.jump:key.keyboard.space");
    write(path.join(templateDir, "config", "sodium-options.json"), "{}");
    write(path.join(templateDir, "config", "nested", "a.toml"), "a=1");
    write(path.join(templateDir, "mods", "sodium.jar"));
    write(path.join(templateDir, "resourcepacks", "pack.zip"));
    write(path.join(templateDir, "shaderpacks", "shader.zip"));
    write(path.join(templateDir, "saves", "World", "level.dat"));
    write(path.join(templateDir, "screenshots", "shot.png"));
    write(path.join(templateDir, "logs", "latest.log"));
    write(path.join(templateDir, "crash-reports", "crash.txt"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("includes settings and configs but no mod JARs, packs or game output", () => {
    const paths = collectTemplateFiles(templateDir).map((f) => f.path).sort();
    expect(paths).toEqual(["config/nested/a.toml", "config/sodium-options.json", "options.txt"]);
  });

  it("only takes the mod list from the profile root", () => {
    const files = collectProfileFiles(profileDir);
    expect(files.map((f) => f.path)).toEqual(["mods.json"]);
    expect(JSON.parse(Buffer.from(files[0].content, "base64").toString("utf-8"))).toEqual({
      mods: [{ slug: "sodium" }],
    });
  });

  it("handles a profile without a mod list", () => {
    fs.rmSync(path.join(profileDir, "mods.json"));
    expect(collectProfileFiles(profileDir)).toEqual([]);
  });
});
