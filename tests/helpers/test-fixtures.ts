/**
 * Test fixtures — factory functions that create valid test data objects.
 *
 * Every factory accepts a partial to override specific fields while
 * providing sensible defaults for everything else.
 */

import type {
  Profile,
  Installation,
  InstallationWithProfile,
  Mod,
  ModIssue,
  ProfilesIndex,
  InstallationsIndex,
  ModrinthMod,
} from "../../src/main/types";
import type { AccountData } from "../../src/types";

// ---------------------------------------------------------------------------
// UUID helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
function uid(prefix = "id"): string {
  return `${prefix}-${String(++_idCounter).padStart(4, "0")}`;
}

export function resetIdCounter(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

const NOW = "2026-06-30T12:00:00.000Z";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function createProfile(overrides: Partial<Profile> = {}): Profile {
  const id = overrides.id ?? uid("profile");
  const name = overrides.name ?? `Test Profile ${id}`;
  return {
    id,
    name,
    description: "",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Installation
// ---------------------------------------------------------------------------

export function createInstallation(overrides: Partial<Installation> = {}): Installation {
  const id = overrides.id ?? uid("inst");
  const name = overrides.name ?? `Test Installation ${id}`;
  return {
    id,
    name,
    profileId: "profile-0001",
    minecraftVersion: "1.21.4",
    fabricLoaderVersion: "0.16.10",
    matchesProfileVersion: true,
    description: "",
    createdAt: NOW,
    playtimeSeconds: 0,
    ...overrides,
  };
}

export function createInstallationWithProfile(
  overrides: Partial<InstallationWithProfile> = {}
): InstallationWithProfile {
  const inst = createInstallation(overrides as Partial<Installation>);
  return {
    ...inst,
    profileName: overrides.profileName ?? "Test Profile",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mod
// ---------------------------------------------------------------------------

export function createMod(overrides: Partial<Mod> = {}): Mod {
  const id = overrides.id ?? uid("mod");
  return {
    id,
    name: `Test Mod ${id}`,
    filename: `test-mod-${id}.jar`,
    version: "1.0.0",
    enabled: true,
    mcVersion: "1.21.4",
    slug: `test-mod-${id}`,
    iconUrl: null,
    isBundled: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ModIssue
// ---------------------------------------------------------------------------

export function createModIssue(overrides: Partial<ModIssue> = {}): ModIssue {
  return {
    slug: "test-mod",
    modName: "Test Mod",
    error: "Something went wrong",
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Modrinth Mod (search result)
// ---------------------------------------------------------------------------

export function createModrinthMod(overrides: Partial<ModrinthMod> = {}): ModrinthMod {
  return {
    slug: "sodium",
    title: "Sodium",
    description: "A modern rendering engine for Minecraft",
    author: "jellysquid3",
    downloads: 5_000_000,
    icon_url: "https://cdn.modrinth.com/data/sodium/icon.png",
    versions: ["1.21.4", "1.21.3", "1.21"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export function createAccount(overrides: Partial<AccountData> = {}): AccountData {
  return {
    username: "TestPlayer",
    uuid: "test-uuid-1234",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Indices
// ---------------------------------------------------------------------------

export function createProfilesIndex(profiles: Profile[] = []): ProfilesIndex {
  const map: Record<string, Profile> = {};
  for (const p of profiles) {
    map[p.id] = p;
  }
  return { version: 1, profiles: map };
}

export function createInstallationsIndex(
  profileId: string,
  installations: Installation[] = []
): InstallationsIndex {
  const map: Record<string, Installation> = {};
  for (const i of installations) {
    map[i.id] = i;
  }
  return { version: 1, profileId, installations: map };
}

// ---------------------------------------------------------------------------
// Pre-built scenarios
// ---------------------------------------------------------------------------

/** A typical setup: one profile with two installations. */
export function typicalScenario() {
  const profile = createProfile({ id: "profile-0001", name: "Main Profile" });
  const inst1 = createInstallationWithProfile({
    id: "inst-0001",
    name: "Main World",
    profileId: profile.id,
    profileName: profile.name,
  });
  const inst2 = createInstallationWithProfile({
    id: "inst-0002",
    name: "Creative Test",
    profileId: profile.id,
    profileName: profile.name,
  });
  const account = createAccount();

  return { profile, installations: [inst1, inst2], account };
}

/** Multiple profiles, each with installations. */
export function multiProfileScenario() {
  const p1 = createProfile({ id: "profile-0001", name: "Main" });
  const p2 = createProfile({ id: "profile-0002", name: "Modded" });
  const i1 = createInstallationWithProfile({ id: "inst-0001", name: "Survival", profileId: p1.id, profileName: p1.name });
  const i2 = createInstallationWithProfile({ id: "inst-0002", name: "Creative", profileId: p1.id, profileName: p1.name });
  const i3 = createInstallationWithProfile({ id: "inst-0003", name: "Fabric Modded", profileId: p2.id, profileName: p2.name });

  return { profiles: [p1, p2], installations: [i1, i2, i3], account: createAccount() };
}

/** Mods list for a typical modded setup. */
export function moddedModsList(): Mod[] {
  return [
    createMod({ id: "mod-01", slug: "sodium", name: "Sodium", filename: "sodium-0.6.9.jar" }),
    createMod({ id: "mod-02", slug: "lithium", name: "Lithium", filename: "lithium-0.14.3.jar" }),
    createMod({ id: "mod-03", slug: "phosphor", name: "Phosphor", filename: "phosphor-0.8.1.jar" }),
    createMod({ id: "mod-04", slug: "iris", name: "Iris Shaders", filename: "iris-1.8.5.jar" }),
    createMod({ id: "mod-05", slug: "fabric-api", name: "Fabric API", filename: "fabric-api-0.115.0.jar", isBundled: true }),
  ];
}
