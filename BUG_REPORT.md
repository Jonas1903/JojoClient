# JojoClient Pre-Release Bug Report

**Generated:** 2026-07-01  
**Version tested:** 1.2.8 (HEAD)  
**Scope:** Full codebase audit — IPC handlers, services, renderer, security, edge cases

---

## CRITICAL (1)

### BUG-1: Path traversal in import bundle — arbitrary file write

**File:** `src/main/services/exportImport.ts`, lines 239–246 and 479–491  
**Severity:** CRITICAL — security vulnerability

The `writeFiles()` helper used by both `importProfileBundle` and `importInstallationBundle` does `path.join(baseDir, file.path)` without validating that the resolved path stays within `baseDir`. A crafted `.jojo` bundle with `../../` in file paths can write arbitrary content outside the intended directory.

```typescript
// exportImport.ts:241 — NO validation before write
const filePath = path.join(baseDir, file.path);
const dir = path.dirname(filePath);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(filePath, Buffer.from(file.content, 'base64'));
```

**How to reproduce:** Create a bundle with `"mods/../../../malicious.txt"` as a file path. Import it. The file is written outside the installation/profile directory.

**Fix:** After `path.resolve(filePath)`, assert that the result starts with the resolved `baseDir`.

---

## HIGH (7)

### BUG-2: deleteProfile can permanently delete installations on partial failure

**File:** `src/main/services/profiles.ts`, lines 394–404  
**Severity:** HIGH — data loss

When deleting a profile, `moveInstallation()` is called for each installation in a `for` loop. If any single move fails (e.g., one installation's game is running, EBUSY), the loop aborts immediately. Then `fs.rmSync(profileDir, { recursive: true })` deletes the **entire** profile directory — including installations that were never moved.

```typescript
for (const installation of Object.values(installationsIndex.installations)) {
    await moveInstallation(installation.id, targetProfile.id); // throws → loop exits
    movedInstallations.push(installation.id);
}
// All installations still in the profile dir get DELETED:
fs.rmSync(profileDir, { recursive: true, force: true });
```

**How to reproduce:**
1. Create a profile with 3 installations
2. Launch Minecraft from one installation
3. Delete the profile → one move fails (game running) → remaining 2 installations are permanently deleted

**Fix:** Collect errors during moves, only delete the directory if all moves succeeded, or move surviving installations back.

### BUG-3: Corrupted `profiles/index.json` throws instead of recreating

**File:** `src/main/services/profiles.ts`, lines 159–162  
**Severity:** HIGH — permanent loss of profile management

`loadProfilesIndex()` does `JSON.parse(data)` without a `try/catch`. A corrupted file (partial write during power loss/crash) causes **every** profile operation to fail permanently. The only recovery is manual file deletion.

```typescript
const data = fs.readFileSync(indexPath, 'utf-8');
const parsed = JSON.parse(data) as ProfilesIndex; // throws on corrupt JSON
```

**How to reproduce:** Corrupt `{basePath}/profiles/index.json` with invalid JSON. All profile APIs return errors. App is bricked until the user manually deletes the file.

**Fix:** Wrap `JSON.parse` in try/catch. On parse failure, log a warning and return a fresh index.

### BUG-4: Corrupted installations index throws instead of recreating

**File:** `src/main/services/profiles.ts`, lines 199–203  
**Severity:** HIGH — same pattern as BUG-3

Identical issue in `loadInstallationsIndex()`. Corrupted `installations/index.json` breaks all installation operations for that profile.

**Fix:** Same as BUG-3 — wrap in try/catch, recreate on failure.

### BUG-5: No game process cleanup on app close — orphaned Minecraft processes

**File:** `electron/main.ts`, no `before-quit` handler  
**Severity:** HIGH — orphaned processes

There is no `before-quit` or `will-quit` handler that kills running game processes. If the user closes the launcher while Minecraft is running, the game process becomes orphaned and continues running with no way to stop it from the launcher.

**How to reproduce:** Launch Minecraft from the launcher, close the launcher window. The Minecraft process keeps running.

**Fix:** Add a `before-quit` handler that calls `killGame()` and iterates `gameProcesses` to ensure all child processes are terminated.

### BUG-6: Update banner Download button can get stuck on "Downloading..."

**File:** `src/App.tsx`, lines 757–760  
**Severity:** HIGH — misleading UI, poor UX

Clicking "Download" immediately sets `state: "downloading"` optimistically, then fires `window.jojoclient.downloadUpdate()` without awaiting the result. If the IPC call returns `{ ok: false }` (dev mode, network error, etc.), the auto-updater events never fire, so the banner stays on "Downloading..." forever with no recovery path. The user has no way to retry.

```typescript
onClick={() => {
    setUpdateStatus((prev) => ({ ...prev, state: "downloading" })); // optimistic
    window.jojoclient.downloadUpdate(); // not awaited, errors swallowed
}}
```

**How to reproduce:** In dev mode, trigger an update check (won't fire), or in production with a failed download. The banner shows "Downloading..." permanently. Only a full app restart clears it.

**Fix:** Await the IPC call. On failure, reset to "available" state and show error. Do not optimistically set "downloading" — wait for the first `download-progress` event.

### BUG-7: deleteMod writes sync state to wrong filename

**File:** `src/main/services/mods.ts`, line 2110  
**Severity:** HIGH — dead code, cache not invalidated

`deleteMod` reads/writes `.sync-state.json` but the actual sync state file is `.jojoclient-sync.json` (from `getSyncStatePath()` at line 1062). The `.sync-state.json` file never exists, so the entire sync state cleanup block is dead code. After deleting a mod, the sync cache is not invalidated — the next sync uses stale cached state.

```typescript
const syncStatePath = path.join(installModsDir, ".sync-state.json"); // WRONG filename
```

**How to reproduce:** Delete a mod from a profile, then trigger a sync. The sync state cache still lists the deleted mod.

**Fix:** Use `getSyncStatePath(installModsDir)` instead of hardcoded string.

### BUG-8: updateTemplateFromInstallation can leave template in inconsistent state

**File:** `src/main/services/profiles.ts`, lines 907–916  
**Severity:** HIGH — partial data loss

The function does `fs.rmSync(destFolder, { recursive: true })` on the template destination, then copies installation files into it. If the copy fails midway (disk full, permission error), the old template is already gone and the new one is incomplete. No backup or rollback.

**How to reproduce:** Fill the disk during a `updateTemplateFromInstallation` call. Template directory is wiped but only partially restored.

**Fix:** Copy to a temp directory first, then atomically rename into place. Or keep a backup.

---

## MEDIUM (8)

### BUG-9: Background sync uses `_event.sender` after handler returns

**File:** `electron/main.ts`, lines 1096–1123  
**Severity:** MEDIUM — potential crash

The `installations:create` handler fires a `void (async () => {...})()` background task that uses `_event.sender.send()` to push mod download progress. If the renderer window is closed before the background sync completes, calling `.send()` on a destroyed `WebContents` can throw.

```typescript
void (async () => {
    // ...
    _event.sender.send("mods:downloadProgress", { ... }); // window may be gone
})();
return { ok: true, installation: result.installation }; // handler returns immediately
```

**Fix:** Check `_event.sender.isDestroyed()` before sending, or use `win?.webContents.send()` with a null check.

### BUG-10: addModToProfile uses hardcoded Minecraft version fallback

**File:** `src/main/services/mods.ts`, line 984  
**Severity:** MEDIUM — wrong dependency resolution

When resolving dependencies for a newly added mod, if no installations exist, the fallback MC version is hardcoded as `"1.21.4"`. Users on other versions (e.g., 1.20.1) get dependencies resolved for the wrong version.

**Fix:** Use `DEFAULT_MC_VERSION` from versions.ts instead of hardcoded string.

### BUG-11: Encryption key derived from changeable home directory

**File:** `src/main/services/auth.ts`, lines 79–83  
**Severity:** MEDIUM — forced re-authentication

`getMachineKey()` derives the AES key from `os.homedir()`. If the Windows user profile path changes, all encrypted tokens become permanently undecryptable, forcing re-authentication.

**How to reproduce:** Change Windows user profile path, restart launcher. All saved accounts are gone.

**Fix:** Use `electron.app.getPath("userData")` (stable across OS account changes) or add a key migration path.

### BUG-12: isSupportedJava blocks Java 22+ for all Minecraft versions

**File:** `src/main/services/launcher.ts`, lines 76–82  
**Severity:** MEDIUM — unnecessary Java downloads

For `required < 21`, the range check is `major >= required && major <= 21`. Users with Java 22+ must auto-download Java 21 even though their existing Java works fine for older MC versions.

```typescript
if (major >= required && major <= 21) return true; // Java 22+ rejected
```

**Fix:** Change upper bound from `21` to `Infinity` or remove it. Only enforce the minimum.

### BUG-13: baseFolder:pick returns inconsistent API shape

**File:** `electron/main.ts`, lines 417–424  
**Severity:** MEDIUM — API inconsistency

`baseFolder:pick` returns `null` when the user cancels, instead of `{ ok: false, canceled: true }`. Every other handler in the app uses the `{ ok: true/false }` pattern. The renderer must handle two different return shapes.

```typescript
if (result.canceled || result.filePaths.length === 0) return null; // inconsistent
```

**Fix:** Return `{ ok: false, canceled: true }`.

### BUG-14: Version caches never refresh

**File:** `src/main/services/versions.ts`, lines 115–116  
**Severity:** MEDIUM — stale data

`cachedVersionManifest` and `cachedFabricLoaders` are cached for the process lifetime. New Minecraft or Fabric releases during a long session are invisible until app restart.

**Fix:** Add a TTL (e.g., 30 minutes) with cache-busting on cache miss.

### BUG-15: downloadAssets silently ignores download failures

**File:** `src/main/services/download.ts`, lines 656–666  
**Severity:** MEDIUM — missing game assets without warning

The asset download loop catches errors and logs them but continues silently. No failure count is tracked, no error is reported upward. The game can launch with missing textures/sounds.

**Fix:** Track failures and return them in the result. Warn the user if assets are missing.

### BUG-16: renameSync in updateProfile can fail with ENOENT

**File:** `src/main/services/profiles.ts`, line 344  
**Severity:** MEDIUM — unhandled error

When profile name changes, `fs.renameSync(oldDir, newDir)` is called without checking if `oldDir` exists. If the directory was deleted externally, ENOENT propagates to the caller.

**How to reproduce:** Delete a profile folder externally, then rename it via the app. The operation fails with an unhelpful error.

**Fix:** Check `fs.existsSync(oldDir)` before renaming, or wrap in try/catch with a clear error message.

---

## LOW (7)

### BUG-17: Unbounded in-memory caches (memory leak)

**File:** `src/main/services/mods.ts`, lines 259, 262, 266  
**Severity:** LOW — slow memory growth

Three `Map`-based caches (`projectIdToSlugCache`, `modVersionByIdCache`, `modVersionCache`) grow without bound. In long sessions with heavy mod browsing, heap grows monotonically.

**Fix:** Add LRU eviction or size caps.

### BUG-18: processPendingSyncs retries failures indefinitely without backoff

**File:** `src/main/services/mods.ts`, lines 903–911  
**Severity:** LOW — repeated failed sync attempts

Failed pending syncs are re-queued forever. No retry count, no exponential backoff. A permanently failing installation (e.g., offline, corrupted) is retried on every trigger.

**Fix:** Add retry count and exponential backoff. Give up after N failures and surface an error.

### BUG-19: execSync blocks event loop for Java version detection

**File:** `src/main/services/launcher.ts`, lines 49–56, 167–169  
**Severity:** LOW — brief UI freeze

`execSync` is used to run `java -version`. On slow/spinning disks, this blocks the event loop for the duration of the child process.

**Fix:** Use `execFile` (async) instead of `execSync`.

### BUG-20: Duplicated blocklist definitions

**File:** `src/main/services/mods.ts`, lines 312–315 and 635–638  
**Severity:** LOW — maintenance risk

Blocked version numbers are defined both in `fetchModrinthVersion` and in `downloadMod`. If one list is updated and the other is missed, blocked content can slip through one path.

**Fix:** Extract blocklist to a single module-level constant used by both functions.

### BUG-21: Duplicated rule evaluation logic

**File:** `src/main/services/download.ts`, lines 192–233 and 290–323  
**Severity:** LOW — maintenance risk

`shouldUseArgument` and `shouldUseLibrary` implement identical rule evaluation logic. A fix in one but not the other causes inconsistent behavior.

**Fix:** Extract shared logic into a single function.

### BUG-22: Pervasive synchronous filesystem APIs

**File:** All service files in `src/main/services/`  
**Severity:** LOW — violates CLAUDE.md rule

`fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`, `fs.mkdirSync`, `fs.rmSync` are used throughout. CLAUDE.md states "Use async filesystem APIs." While tolerable for a single-process Electron app, it blocks moving services to worker threads.

### BUG-23: No runtime IPC argument validation

**File:** `electron/main.ts`, all handlers  
**Severity:** LOW — type safety at compile time only

IPC handlers pass received data directly to service functions without runtime validation. If the renderer sends `{ profileId: 123 }` (number instead of string) due to a bug, the service receives unexpected types.

**Fix:** Not urgent — TypeScript provides compile-time checks. Add runtime validation if the renderer is ever untrusted.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 (security) |
| HIGH     | 7 (data loss, orphaned processes, dead code, UI freeze) |
| MEDIUM   | 8 (crashes, wrong fallbacks, cache issues, inconsistency) |
| LOW      | 7 (memory leak, maintenance, style) |
| **Total** | **23** |

### Top 5 to fix before release:

1. **BUG-1** — Path traversal (security)
2. **BUG-2** — deleteProfile data loss
3. **BUG-3 / BUG-4** — Corrupted index resilience (trivial fix, huge impact)
4. **BUG-5** — Orphaned game processes on close
5. **BUG-6** — Update banner stuck on "Downloading..."
