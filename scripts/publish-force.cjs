/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
// Re-publishes the current package.json version: deletes the existing GitHub
// release and its tag on the public releases repo, then rebuilds and publishes.
// The repo must match "publish" in electron-builder.json5.
//
// Deleting a release also deletes its download counts, and users who already
// installed it keep running a build that no longer exists. So a release that
// has been downloaded is only replaced with --allow-downloaded.
const { execSync } = require("child_process");
const { version } = require("../package.json");

const RELEASES_REPO = "Jonas1903/JojoClient";
const tag = `v${version}`;
const allowDownloaded = process.argv.includes("--allow-downloaded");

function getExistingRelease() {
  try {
    const json = execSync(`gh release view ${tag} --repo ${RELEASES_REPO} --json assets`, {
      stdio: ["ignore", "pipe", "pipe"],
    }).toString();
    return JSON.parse(json);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : "";
    if (/release not found/i.test(stderr)) return null;
    throw new Error(`Could not check release ${tag} on ${RELEASES_REPO}: ${stderr || e.message}`);
  }
}

const existing = getExistingRelease();
if (existing) {
  const downloads = existing.assets
    .filter((a) => a.name.endsWith(".exe"))
    .reduce((sum, a) => sum + (a.downloadCount || 0), 0);
  if (downloads > 0 && !allowDownloaded) {
    console.error(
      `${tag} has ${downloads} installer download(s). Bump the version and use "npm run publish" instead, ` +
        `or rerun with --allow-downloaded to delete it anyway.`
    );
    process.exit(1);
  }
  execSync(`gh release delete ${tag} --yes --cleanup-tag --repo ${RELEASES_REPO}`, { stdio: "inherit" });
} else {
  console.log(`No existing release ${tag} on ${RELEASES_REPO}, publishing fresh.`);
}

execSync("vite build && tsc -p tsconfig.electron.json && electron-builder --publish always", { stdio: "inherit" });
