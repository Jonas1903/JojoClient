import { describe, expect, it, vi } from "vitest";
import { buildProfileExport, deserializeProfile, migrateProfileExport, resolveProfileConflicts } from "../src/main/services/profileSerializer";
import { PROFILE_EXPORT_FORMAT } from "../src/main/services/profileExportSchema";
import type { ProfilesIndex } from "../src/main/types";

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomUUID: () => "new-profile-id",
  };
});

describe("profile export/import", () => {
  it("exports unknown fields", () => {
    const profile = { id: "id-1", name: "Test", extra: { foo: "bar" } };
    const exported = buildProfileExport(profile, [], []);
    expect(exported.format).toBe(PROFILE_EXPORT_FORMAT);
    expect(exported.profile).toMatchObject({ extra: { foo: "bar" } });
  });

  it("imports preserve unknown fields", () => {
    const profile = { id: "id-2", name: "Test", unknownField: 123 };
    const parsed = deserializeProfile(profile);
    expect(parsed).toMatchObject({ unknownField: 123 });
  });

  it("conflict resolution changes id and name", () => {
    const index: ProfilesIndex = {
      version: 1,
      profiles: {
        "id-1": { id: "id-1", name: "Test", createdAt: "", updatedAt: "" },
      },
    };
    const resolved = resolveProfileConflicts({ id: "id-1", name: "Test" }, index);
    expect(resolved.id).toBe("new-profile-id");
    expect(resolved.name).toContain("Imported");
  });

  it("migration pipeline keeps data", () => {
    const envelope = {
      format: PROFILE_EXPORT_FORMAT,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: { id: "id-3", name: "Test" },
    };
    const migrated = migrateProfileExport(envelope);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.profile).toMatchObject({ id: "id-3" });
  });
});
