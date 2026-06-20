import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.mock calls are hoisted before imports, so the factories run first.
vi.mock("../src/main/services/java", () => ({
  ensureJava: vi.fn().mockResolvedValue("/fake/jdk/bin/java.exe"),
  getBundledJavaPath: vi.fn().mockReturnValue(null),
  JavaProgress: undefined,
}));

vi.mock("../src/main/utils/storage", () => ({
  readSettings: vi.fn().mockReturnValue({ basePath: "C:\\test\\jojoclient" }),
}));

vi.mock("../src/main/services/auth", () => ({
  getAccount: vi.fn().mockReturnValue(null),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue([]),
  };
});

vi.mock("child_process", async () => {
  const actual = await vi.importActual<typeof import("child_process")>("child_process");
  return {
    ...actual,
    execSync: vi.fn().mockImplementation(() => {
      throw new Error("java not in PATH");
    }),
    spawn: vi.fn().mockReturnValue({
      pid: 99999,
      on: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    }),
  };
});

import { resolveJavaPath } from "../src/main/services/launcher";
import { ensureJava } from "../src/main/services/java";

describe("launcher: Java path resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ensureJava as ReturnType<typeof vi.fn>).mockResolvedValue("/fake/jdk/bin/java.exe");
  });

  it("resolves to the path returned by ensureJava", async () => {
    const result = await resolveJavaPath("1.21.4");
    expect(result).toBe("/fake/jdk/bin/java.exe");
  });

  it("requests Java 21 for Minecraft 1.21.4", async () => {
    await resolveJavaPath("1.21.4");
    expect(ensureJava).toHaveBeenCalledWith(
      21,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it("requests Java 21 for Minecraft 1.21", async () => {
    await resolveJavaPath("1.21");
    expect(ensureJava).toHaveBeenCalledWith(
      21,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it("requests Java 17 for Minecraft 1.20.4", async () => {
    await resolveJavaPath("1.20.4");
    expect(ensureJava).toHaveBeenCalledWith(
      17,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it("requests Java 17 for Minecraft 1.18.2", async () => {
    await resolveJavaPath("1.18.2");
    expect(ensureJava).toHaveBeenCalledWith(
      17,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it("requests Java 17 for Minecraft 1.16.5", async () => {
    await resolveJavaPath("1.16.5");
    expect(ensureJava).toHaveBeenCalledWith(
      17,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it("requests Java 21 for a future 2.x version", async () => {
    await resolveJavaPath("2.0.0");
    expect(ensureJava).toHaveBeenCalledWith(
      21,
      expect.any(Function),
      expect.any(Function)
    );
  });
});
