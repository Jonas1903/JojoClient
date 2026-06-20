# Versions - Minecraft & Fabric Version Selection Guide

## What It Does

The Versions feature lets you:
- Choose which version of Minecraft to play
- Choose which version of Fabric (mod system) to use
- Download all the files needed for that version
- Verify everything is correct

## Minecraft Versions

### What Are Versions?

Each Minecraft version has different features, blocks, creatures, and gameplay:
- **1.21.4** - Newest version with latest features
- **1.20.x** - Previous major version
- **1.19.x** - Earlier version
- And so on...

Each version is like a different "game" with its own rules and features.

### Version Types

Minecraft has different types of releases:

| Type | What It Is |
|------|-----------|
| **Release** | Stable, fully finished versions (like 1.21.4) |
| **Snapshot** | Test versions with new features being tested |
| **Old Versions** | Previous versions from years ago |

**Recommendation**: Use the latest **Release** version unless you have a specific reason not to.

### Choosing a Minecraft Version

When creating an installation, you pick:
1. **Minecraft Version** - Which game version you want (1.21, 1.20, etc.)
2. What mods you want (some mods only work on specific versions)

### Version Compatibility

**Important**: Not all mods work on all versions!

- A mod made for 1.20 probably won't work on 1.21
- A mod for 1.21 might not work on 1.20
- You need to check if your mods support the version you choose

## Fabric Loader Versions

### What is Fabric?

Fabric is a system that allows mods to be installed in Minecraft. It's like a "layer" that:
- Lets mods modify the game safely
- Manages mod dependencies
- Prevents mods from breaking each other (usually)

Every Minecraft version has compatible Fabric versions.

### Stable vs Development

- **Stable** - Tested, reliable versions (recommended)
- **Development** - Experimental versions with new features (not recommended unless you know what you're doing)

### Fabric Version Selection

For each Minecraft version, JojoClient automatically suggests the latest **stable** Fabric version. You can usually:
- Stick with the recommended version
- Manually select a different version if needed (rarely necessary)

### Version Combinations

You need compatible combinations:
- Minecraft 1.21.4 + Fabric 0.18.4 ✅ Compatible
- Minecraft 1.20.4 + Fabric 0.15.3 ✅ Compatible
- Minecraft 1.21.4 + Fabric 0.15.3 ❌ Not compatible

JojoClient handles this automatically - it won't let you pick incompatible combinations.

## Downloading Versions

### First-Time Download

When you create an installation with a new Minecraft + Fabric combination for the first time:

1. JojoClient downloads **Minecraft files** (the base game - about 100-500 MB)
2. JojoClient downloads **Fabric** (the mod system - about 10 MB)
3. JojoClient downloads **Libraries** (supporting code - about 500 MB to 1 GB)
4. JojoClient downloads **Assets** (textures, sounds, models - about 200 MB to 1 GB)

**Total**: Usually 1-3 GB depending on version, with internet connection.

### Subsequent Launches

If you already have an installation with that version, launching is much faster because:
- Files are already downloaded
- Only small updates (if any) are downloaded
- Game starts quickly

### Verification

JojoClient verifies all downloaded files:
- Checks file integrity using SHA-1 hashes
- Makes sure files aren't corrupted
- Re-downloads any corrupted files automatically

## Storage Considerations

Each Minecraft version + Fabric combination takes up space:

- **Base game files**: 1-3 GB per version
- **Mods**: 1-100 MB each (depending on mod)
- **World saves**: Varies (typically 100 MB to 1 GB+ per world)

You can have multiple versions installed at once, so storage adds up.

**Example**:
- Version 1.21.4: 2 GB
- Version 1.20.4: 2 GB
- Two profiles with mods: 500 MB - 5 GB

Total: 5-10 GB+ easily.

## Version Updates

### Minecraft Updates

Mojang releases new Minecraft versions regularly:
- Major updates (like 1.20 → 1.21): Add significant features
- Minor updates (like 1.21.1 → 1.21.2): Bug fixes
- Snapshots: Test versions for upcoming features

You're not forced to update - you can keep playing older versions.

### Fabric Updates

Fabric updates regularly with:
- Bug fixes
- Compatibility improvements
- New features

When a new Fabric version is released, you can choose to use it for new installations.

## Choosing the Right Version

### For New Players
- Use the **latest stable release** (like 1.21.4)
- Use the recommended **Fabric version**
- Mods for the latest version are usually abundant

### For Stability
- Use a version that's been out for a while (like 1.20.4)
- More mods are tested on older versions
- Fewer bugs than brand new versions

### For Specific Mods
- Check which versions the mods support
- Choose a Minecraft version compatible with your desired mods
- Then set up Fabric for that version

## Version Management

### Keeping Old Versions

You can keep older installations for:
- Playing previous modpacks
- Testing old mods
- Compatibility reasons
- Nostalgia

Old versions take up storage, so delete them if you don't need them.

### Switching Between Versions

Create different **installations** for different versions:
- Installation 1: 1.21.4 with new mods
- Installation 2: 1.20.4 with legacy mods
- Installation 3: 1.19.2 for old modpack

Each installation is independent and can be played separately.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Mod not working | Check it supports your Minecraft version |
| "Version not found" | Download it first (automatically happens) |
| Game won't start | Verify Fabric is compatible with MC version |
| Out of storage | Delete old versions you don't use |

## Quick Reference

**Latest Stable**: 1.21.4
**Long-term Popular**: 1.20.4
**Most Mods Available**: Latest + Version-1 (usually has most modding activity)

